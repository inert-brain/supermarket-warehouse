"""Manual-only read-only Streamlit reporting UI."""
from datetime import UTC, datetime
import os
from pathlib import Path
from html import escape
from math import isfinite

import pandas as pd
import streamlit as st

from firebase_client import ACTIVITY_TYPES, FIELDS, STATUSES, Config, FirebaseClient
from metrics import expiry_label, quality_warnings, slot_cards, stock_metrics
from sync_state import sync_snapshot
from firestore_client import ShelfReadError, fetch_shelves, fetch_product

SHELF_PRODUCTS = {"SHELF_01": "Milk", "SHELF_02": "Cereal", "SHELF_03": "Juices"}
DEMO_DEMAND = {
    "Milk": ([4, 3, 5, 4, 6, 5, 4], 5),
    "Cereal": ([2, 3, 2, 4, 3, 2, 3], 3),
    "Juices": ([3, 4, 5, 3, 4, 5, 4], 4),
}


def configured_client():
    # Configuration is read only when Sync is explicitly requested.
    try:
        settings = dict(st.secrets.get("firebase", {}))
    except FileNotFoundError:
        settings = {}
    defaults = {"project": "smart-warehouse-3171e", "region": "asia-southeast1",
                "service": "smart-warehouse-service", "connector": "example"}
    values = {key: settings.get(key, os.environ.get(f"FIREBASE_{key.upper()}", default))
              for key, default in {"api_key": "", "app_id": "", **defaults}.items()}
    return FirebaseClient(Config(**values))


def frame(rows, table):
    result = pd.DataFrame(rows, columns=FIELDS[table])
    for field in ("statusUpdatedAt", "assignedAt", "occupancyUpdatedAt", "occurredAt"):
        if field in result:
            result[field] = pd.to_datetime(result[field], utc=True, format="mixed")
    return result


def show_table(data):
    if data.empty:
        st.info("No records match these filters.")
    st.dataframe(data, hide_index=True, width="stretch")


def render_product_info(product, saved_barcode):
    price = product.get("priceCentavos")
    price_text = (f"PHP {price / 100:,.2f}" if type(price) in (int, float) and isfinite(price)
                  else "Price unavailable")
    active = product.get("active")
    status = "Active" if active is True else "Inactive" if active is False else "Not specified"
    name = escape(str(product.get("name") or "Unnamed product"))
    product_id = escape(str(product.get("id") or "Not specified"))
    barcode = escape(str(product.get("barcode") or saved_barcode))
    st.markdown(f"""
<section class="product-info" aria-label="Product details">
  <div class="product-info-label">PRODUCT DETAILS</div>
  <h4>{name}</h4>
  <div class="product-info-price">{price_text}</div>
  <dl>
    <dt>Product ID</dt><dd>{product_id}</dd>
    <dt>Barcode</dt><dd>{barcode}</dd>
    <dt>Catalog status</dt><dd>{status}</dd>
  </dl>
</section>
""", unsafe_allow_html=True)


def render(snapshot):
    stocks, slots, activities = (snapshot[key] for key in ("stocks", "slots", "activities"))
    st.caption(f"Last successful sync: {snapshot['completed_at'].isoformat()} · "
               f"Started: {snapshot['started_at'].isoformat()} · "
               f"Stocks: {len(stocks)} · Slots: {len(slots)} · Activities: {len(activities)}")
    st.warning("Manually refreshed reporting copy; data may be stale. Pages and tables are not a transactionally consistent snapshot.")
    reference_at = snapshot["completed_at"]
    age = max(0, (datetime.now(UTC) - reference_at).total_seconds())
    st.caption(f"Snapshot age at this render: {age:.0f}s. Observation ages below are measured at sync completion, "
               "not live rack availability. Age is display-only. No polling; click Sync for new data.")
    st.subheader("Slot monitor — at last sync, not live")
    cards = slot_cards(stocks, slots, reference_at)
    for start in (0, 4):
        for column, card in zip(st.columns(4), cards[start:start + 4]):
            with column.container(border=True, key=f"slot-card-{card['slotId']}"):
                st.markdown(f'<h3 class="slot-name">Slot {card["slotId"]}</h3>', unsafe_allow_html=True)
                container = card["containerID"]
                if container is None:
                    if not card["available"]:
                        st.text(card["status"])
                else:
                    stock = next((row for row in stocks if row["containerID"] == container), {})
                    code = stock.get("description")
                    detail_key = (container, code)
                    if st.button(container, key=f"barcode-{card['slotId']}", type="primary"):
                        if not code:
                            st.session_state["product_detail"] = (detail_key, None, "No product barcode is saved in this container's description.")
                        else:
                            try:
                                with st.spinner("Loading product…"):
                                    fields = fetch_product(code)
                                st.session_state["product_detail"] = (detail_key, fields, None)
                            except ShelfReadError as exc:
                                st.session_state["product_detail"] = (detail_key, None, str(exc))
                    detail = st.session_state.get("product_detail")
                    if detail and detail[0] == detail_key:
                        if detail[2]:
                            st.info(detail[2])
                        else:
                            render_product_info(detail[1], code)
                if card["available"]:
                    st.markdown(f'<div class="slot-status-available">{escape(card["status"])} · at sync</div>', unsafe_allow_html=True)
                else:
                    st.caption(f"{card['status']} · at sync")
                sensor = {True: "Occupied", False: "Vacant", None: "Unknown"}[card["isOccupied"]]
                st.caption(f"Last sensor report: {sensor} · {card['observation_status']}")
                observed = card["occupancyUpdatedAt"]
                observed_utc = (datetime.fromisoformat(observed)
                                .astimezone(UTC).isoformat() if observed else "Unknown observation time")
                st.caption(f"Observed (UTC): {observed_utc}")
    st.caption("Awaiting placement (EMPTY) is reserved but not counted as warehouse stock. "
               "PENDING_DISPATCH is off-rack / reserved and still counted. "
               "Known occupied slots are unavailable, even with old or missing observation times. "
               "Unassigned slots with false/unknown occupancy count as demo availability, not confirmed physical vacancy.")

    summary = stock_metrics(stocks, slots, reference_at)
    for column, label, key in zip(st.columns(4),
                                ("Warehouse units", "On rack (stock status)", "Pending dispatch", "Available slots (demo, at sync)"),
                                ("warehouse", "on_rack", "pending_dispatch", "available_slots")):
        column.metric(label, summary[key], border=True)
    st.caption(f"Not currently in warehouse (EMPTY): {summary['empty']} · Assigned slots: {summary['assigned_slots']}. "
               "Demo availability: unassigned and saved occupancy is not true (false or unknown), regardless of age. "
               "Unknown does not prove vacancy; reserved slots are unavailable. Stock totals use saved stock status.")
    threshold = st.number_input("Low-stock threshold (local display only)", min_value=0, value=2, step=1)
    low_stock = summary["warehouse"] <= threshold
    with st.container(border=True, key="stock-alert-low" if low_stock else "stock-alert-normal"):
        label = "Low stock" if low_stock else "Stock level OK"
        st.markdown(f"**{label}: {summary['warehouse']} warehouse units (threshold {threshold}).**")
    st.subheader("Current stock status")
    st.bar_chart(pd.Series(summary["status_counts"], name="Units"))

    warnings = quality_warnings(stocks, slots, reference_at)
    if warnings:
        with st.expander(f"Data quality warnings ({len(warnings)})", expanded=True):
            for warning in warnings:
                st.warning(warning)
    stock_df, slot_df, activity_df = frame(stocks, "stocks"), frame(slots, "slots"), frame(activities, "activities")
    st.subheader("Local filters")
    product = st.text_input("Container ID contains (all tables)")
    statuses = st.multiselect("Stock status", STATUSES, default=list(STATUSES))
    event_types = st.multiselect("Activity type", ACTIVITY_TYPES, default=list(ACTIVITY_TYPES))
    dates = st.date_input("Activity date range (UTC; optional)", value=[])
    for data in (stock_df, slot_df, activity_df):
        if product:
            data.drop(data.index[~data["containerID"].fillna("").str.contains(product, regex=False)], inplace=True)
    stock_df = stock_df[stock_df["currentStatus"].isin(statuses)].copy()
    stock_df["expiry"] = stock_df["expiresOn"].map(expiry_label)
    activity_df = activity_df[activity_df["activityType"].isin(event_types)]
    if len(dates) == 2:
        day = activity_df["occurredAt"].dt.date
        activity_df = activity_df[(day >= dates[0]) & (day <= dates[1])]
    elif len(dates) == 1:
        st.info("Select an end date to apply the activity date filter.")
    activity_df = activity_df.sort_values(["occurredAt", "activityId"], ascending=[False, False])
    st.subheader("Daily activity event counts (UTC)")
    st.caption("Events are not historic stock balances. ON_RACK includes first placements/returns; REMOVED is expired-scan rejection.")
    if activity_df.empty:
        st.info("No activity records match these filters.")
    else:
        daily = activity_df.groupby([activity_df["occurredAt"].dt.floor("D"), "activityType"]).size().unstack(fill_value=0)
        st.bar_chart(daily.reindex(columns=ACTIVITY_TYPES, fill_value=0))
    for tab, data in zip(st.tabs(["Stocks", "Slots", "Activities"]), (stock_df, slot_df, activity_df)):
        with tab:
            show_table(data)
    st.caption("Expiry uses this computer's local date, valid through today; expiry does not change inventory counts. Timestamps are UTC.")


def sync_shelf_snapshot():
    try:
        with st.spinner("Reading shelf contents…"):
            st.session_state["shelf_snapshot"] = fetch_shelves(
                os.environ.get("FIRESTORE_PROJECT", "mart-parking-fdd6b"))
        st.session_state.pop("shelf_error", None)
    except ShelfReadError as exc:
        st.session_state["shelf_error"] = str(exc)


def render_shelf_alerts():
    st.subheader("Shelf stock alerts")
    st.button("Sync shelf alerts", key="sync_shelf_alerts", on_click=sync_shelf_snapshot)
    snapshot = st.session_state.get("shelf_snapshot")
    if st.session_state.get("shelf_error"):
        st.error(st.session_state["shelf_error"])
        if snapshot is not None:
            st.info("Any counts shown below are from the previous sync.")
    if snapshot is None:
        st.info("Shelf stock not loaded. Click Sync shelf alerts.")
        return
    st.write(f"Shelf counts at last sync (UTC): {snapshot['completed_at'].isoformat()} · not live")
    by_id = {shelf["id"]: shelf["fields"] for shelf in snapshot["shelves"]}
    for shelf_id, product in SHELF_PRODUCTS.items():
        remaining = by_id.get(shelf_id, {}).get("remaining")
        label = f"Shelf {int(shelf_id[-2:])} · {product}"
        if type(remaining) is not int or remaining < 0:
            st.info(f"{label}: remaining count unavailable.")
        elif remaining <= 1:
            with st.container(border=True, key=f"stock-alert-low-{shelf_id}"):
                status = "OUT OF STOCK" if remaining == 0 else "LOW STOCK"
                st.markdown(f"**{label} — {status}: {remaining} remaining.**")
        else:
            with st.container(border=True, key=f"stock-alert-shelf-ok-{shelf_id}"):
                st.markdown(f"**{label}: {remaining} remaining · stock OK**")


def render_shelves():
    st.header("Shelf monitor")
    st.caption("Firestore · products / SHELF_* · refreshed only with Sync shelves or Sync shelf alerts")
    st.button("Sync shelves", key="sync_shelves", type="primary", on_click=sync_shelf_snapshot)
    if st.session_state.get("shelf_error"):
        st.error(st.session_state["shelf_error"])
        st.info("Any previous shelf snapshot is retained.")
    snapshot = st.session_state.get("shelf_snapshot")
    if snapshot is None:
        st.info("Click Sync shelves to load shelf contents.")
        return
    st.caption(f"Last shelf sync (UTC): {snapshot['completed_at'].isoformat()} · not live")
    if not snapshot["shelves"]:
        st.info("No SHELF_ records found in the products collection.")
    labels = {"capacity": "Capacity", "remaining": "Remaining", "partial": "Partial",
              "purchased": "Purchased", "removed": "Removed", "cartQuantity": "In carts",
              "unverified": "Unverified", "verified": "Verified"}
    for shelf in snapshot["shelves"]:
        fields = shelf["fields"]
        with st.container(border=True, key=f"shelf-card-{shelf['id']}"):
            product = SHELF_PRODUCTS.get(shelf["id"])
            st.subheader(shelf["id"] + (f" · {product}" if product else ""))
            initialized = fields.get("initialized")
            st.caption("Initialized" if initialized is True else
                       "Not initialized" if initialized is False else "Initialization unknown")
            columns = st.columns(4)
            for index, (field, label) in enumerate(labels.items()):
                value = fields.get(field)
                columns[index % 4].metric(label, str(value) if value is not None else "Unknown")
            st.caption(f"Updated: {fields.get('updatedAt', 'Unknown')} · saved Firestore values")
            with st.expander("All shelf contents"):
                st.json(fields)


def render_predictions():
    st.markdown('<div class="section-tag">03 / LOOKING AHEAD</div>', unsafe_allow_html=True)
    st.header("Predictions")
    with st.container(border=True, key="prediction-panel"):
        st.info("Demo data and illustrative forecast — not calculated from live inventory.")
        product = st.selectbox("Product", list(DEMO_DEMAND), key="prediction_product")
        history, daily_forecast = DEMO_DEMAND[product]
        st.subheader(f"{product} demand / next 3 days")
        daily, total = st.columns(2)
        daily.markdown(f"**Forecast daily demand: {daily_forecast} units/day**")
        total.markdown(f"**Three-day total: {daily_forecast * 3} units**")
        graph = pd.DataFrame({
            "Day": range(1, 11),
            "Sample demand": history + [None] * 3,
            "Example forecast": [None] * 6 + [history[-1]] + [daily_forecast] * 3,
        })
        st.line_chart(graph, x="Day", y=["Sample demand", "Example forecast"],
                      color=["#161712", "#ff7847"], x_label="Day", y_label="Units/day", height=320)
        st.caption("Days 1–7: sample demand. Orange line: fixed example forecast for Days 8–10, joined to the last sample point. No live prediction or inventory changes.")


def main():
    st.set_page_config(page_title="Warehouse Dashboard", layout="wide")
    styles = Path(__file__).with_name("style.css").read_text(encoding="utf-8")
    st.markdown(f"<style>{styles}</style>", unsafe_allow_html=True)
    st.markdown('<div class="rack-kicker">INVENTORY CONTROL / 08 SLOTS</div>', unsafe_allow_html=True)
    st.title("THE RACK.")
    st.markdown("WAREHOUSE CONTROL BOARD  /  MANUAL SYNC")
    sync_control = st.empty()
    if sync_control.button("Sync warehouse", key="sync", disabled=st.session_state.get("sync_running", False), type="primary"):
        sync_control.empty()
        sync_control.button("Sync warehouse", key="sync_busy", disabled=True, type="primary")
        with st.spinner("Reading all stocks, slots and activities…"):
            sync_snapshot(st.session_state, configured_client)
        st.rerun()
    if st.session_state.get("sync_error"):
        st.error(st.session_state["sync_error"])
        st.info("Sync failed. Any previous complete snapshot and last-success time are unchanged.")
    snapshot = st.session_state.get("snapshot")
    overview, shelves, predictions, about = st.tabs(["01 / OVERVIEW", "02 / SHELVES", "03 / PREDICTIONS", "04 / ABOUT"])
    with overview:
        render_shelf_alerts()
        if snapshot is None:
            if st.session_state.get("sync_error"):
                st.error(f"Warehouse Sync failed: {st.session_state['sync_error']}")
            else:
                st.info("Warehouse slots are not loaded. Click Sync warehouse at the top of the page. Sync shelf alerts only refreshes shelves.")
        else:
            render(snapshot)
    with shelves:
        render_shelves()
    with predictions:
        render_predictions()
    with about:
        st.markdown('<div class="section-tag">04 / THE SYSTEM</div>', unsafe_allow_html=True)
        st.header("About this board")
        left, right = st.columns([2, 1])
        with left.container(border=True, key="about-panel"):
            st.subheader("Eight slots. One clear picture.")
            st.write("The rack uses physical sensors to report whether each slot is occupied. Barcodes identify containers, and Firebase stores assignments and activity.")
            st.write("Use Sync to load a reporting snapshot. Filters change the view locally; the dashboard does not edit inventory.")
        with right.container(border=True, key="about-note"):
            st.subheader("Read the rack")
            st.write("A sensor detects presence, not identity. An assigned empty slot can still be reserved for a container.")
            st.caption("Timestamps are shown in UTC. Data reflects the last successful sync.")


if __name__ == "__main__":
    main()

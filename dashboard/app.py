"""Manual-only read-only Streamlit reporting UI."""
from datetime import UTC, datetime
import os

import pandas as pd
import streamlit as st

from firebase_client import ACTIVITY_TYPES, FIELDS, STATUSES, Config, FirebaseClient
from metrics import expiry_label, quality_warnings, slot_cards, stock_metrics
from sync_state import sync_snapshot


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
    summary = stock_metrics(stocks, slots, reference_at)
    for column, label, key in zip(st.columns(4),
                                ("Warehouse units", "On rack (stock status)", "Pending dispatch", "Available slots (demo, at sync)"),
                                ("warehouse", "on_rack", "pending_dispatch", "available_slots")):
        column.metric(label, summary[key])
    st.caption(f"Not currently in warehouse (EMPTY): {summary['empty']} · Assigned slots: {summary['assigned_slots']}. "
               "Demo availability: unassigned and saved occupancy is not true (false or unknown), regardless of age. "
               "Unknown does not prove vacancy; reserved slots are unavailable. Stock totals use saved stock status.")
    threshold = st.number_input("Low-stock threshold (local display only)", min_value=0, value=2, step=1)
    if summary["warehouse"] <= threshold:
        st.warning(f"Low stock: {summary['warehouse']} warehouse units (threshold {threshold}).")
    st.subheader("Current stock status")
    st.bar_chart(pd.Series(summary["status_counts"], name="Units"))

    warnings = quality_warnings(stocks, slots, reference_at)
    if warnings:
        with st.expander(f"Data quality warnings ({len(warnings)})", expanded=True):
            for warning in warnings:
                st.warning(warning)
    st.subheader("Slot monitor — at last sync, not live")
    cards = slot_cards(stocks, slots, reference_at)
    for start in (0, 4):
        for column, card in zip(st.columns(4), cards[start:start + 4]):
            with column:
                st.markdown(f"**Slot {card['slotId']}**")
                st.text(card["productID"] if card["productID"] is not None else card["status"])
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

    stock_df, slot_df, activity_df = frame(stocks, "stocks"), frame(slots, "slots"), frame(activities, "activities")
    st.subheader("Local filters")
    product = st.text_input("Product ID contains (all tables)")
    statuses = st.multiselect("Stock status", STATUSES, default=list(STATUSES))
    event_types = st.multiselect("Activity type", ACTIVITY_TYPES, default=list(ACTIVITY_TYPES))
    dates = st.date_input("Activity date range (UTC; optional)", value=[])
    for data in (stock_df, slot_df, activity_df):
        if product:
            data.drop(data.index[~data["productID"].fillna("").str.contains(product, regex=False)], inplace=True)
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


def main():
    st.set_page_config(page_title="Warehouse Dashboard", layout="wide")
    st.title("Warehouse Dashboard")
    sync_control = st.empty()
    if sync_control.button("Sync", key="sync", disabled=st.session_state.get("sync_running", False), type="primary"):
        sync_control.empty()
        sync_control.button("Sync", key="sync_busy", disabled=True, type="primary")
        with st.spinner("Reading all stocks, slots and activities…"):
            sync_snapshot(st.session_state, configured_client)
        st.rerun()
    if st.session_state.get("sync_error"):
        st.error(st.session_state["sync_error"])
        st.info("Sync failed. Any previous complete snapshot and last-success time are unchanged.")
    snapshot = st.session_state.get("snapshot")
    if snapshot is None:
        st.info("No data loaded. Click Sync.")
    else:
        render(snapshot)


if __name__ == "__main__":
    main()

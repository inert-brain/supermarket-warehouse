# Simple Read-Only Warehouse Dashboard — MVP Plan

Implemented in `dashboard/`. Occupancy semantics below follow `esp32/plan.md`;
older assignment-only availability and immediate-placement assumptions are superseded.
See `README.md` for the current deployed-query prerequisite and test commands.

## Goal

Build a Streamlit dashboard that manually reads **all records from the three current Firebase Data Connect tables**—Stock, Slot, and Activity—and displays stock levels, graphs, slot assignments, and history. A **Sync** button refreshes the data. No automatic sync, database mutations, or inventory editing.

## Architecture and setup

```text
Sync button → deployed Data Connect read queries → cloud PostgreSQL
                         ↓
                in-memory dashboard snapshot → metrics, graphs, tables
```

Use the existing Streamlit implementation, not another mobile app or custom API server. Run locally for this MVP; the phone and ESP32 remain independent.

Create `dashboard/app.py`, `firebase_client.py`, `metrics.py`, `requirements.txt`, and `README.md`. Use Python, Streamlit, Requests, and pandas. Streamlit's built-in charts are sufficient; no separate charting package is required initially.

```sh
# From dashboard/
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m streamlit run app.py
```

Pin compatible tested versions during implementation. Ignore `.venv/` and local Streamlit secrets. Configure Firebase public API key, app ID, project `smart-warehouse-3171e`, region `asia-southeast1`, service `smart-warehouse-service`, and connector `example` in local Streamlit configuration. Do not commit credentials or add service-account/database passwords to the UI.

## Read-only Firebase access

Use the existing predefined-operation HTTPS REST interface, as the ESP32 does, through Requests. POST to the connector's `:executeQuery` endpoint with operationName and variables. This HTTP POST executes a **read query**, not a database write. Never call `:executeMutation`.

Cloud-maintainer prerequisite (separate deployment, not dashboard work): provide these three narrowly defined dashboard queries before use:

- Stocks: productID, currentStatus, statusUpdatedAt, description, expiresOn.
- Slots: slotId, productID, assignedAt, isOccupied, occupancyUpdatedAt. The new occupancy fields are nullable, but both response properties are required after coordinated cloud deployment; missing properties fail the complete Sync.
- Activities: activityId, productID, occurredAt, activityType.

Fetch every page, not only the default result limit. Use bounded pages (for example, 100 rows), stable ascending key order, and cursor/key-based pagination. Follow the generated filter/order syntax for the installed Data Connect tooling. Continue until all records are read; deduplicate by primary key. No arbitrary GraphQL supplied by the browser.

Validate HTTP status, JSON, GraphQL errors, required fields, and enum values. Use finite request timeouts. A permission failure, missing operation, malformed page, or network failure is not an empty database.

These queries are PUBLIC under the current prototype's no-auth policy and expose full inventory and activity history. Document this exposure before deployment. The dashboard itself must contain **no write operation**, even though other app operations share the connector. Firebase public configuration does not grant or enforce read-only access by itself.

## Manual Sync behavior

- Initial screen: show **“No data loaded. Click Sync.”** Do not fetch automatically at startup.
- Only clicking **Sync** makes Firebase requests. No timers, subscriptions, refresh polling, or fetch-on-widget-change.
- Disable duplicate Sync submissions while a sync is running; show a spinner.
- Fetch all three datasets into temporary variables and validate them.
- Replace the displayed snapshot only after the entire sync succeeds. Store it in `st.session_state` so ordinary Streamlit reruns and filter changes do not refetch cloud data.
- Show **last successful sync time**, record counts, and a stale-data notice: this is a manually refreshed view.
- On failure, retain the previous successful snapshot and show a clear error. Do not replace it with zeros or partially fetched tables.
- Data Connect queries/pages are not guaranteed a consistent cross-table snapshot. This is a reporting copy, not inventory authority. Display sync start/end time if useful; if data changes during sync, the next manual Sync refreshes it. Do not add locking or a backend for the MVP.
- No separate SQLite copy is needed initially. In-memory session data keeps this simpler. Persistent offline storage can be a later feature; do not sync with `data/warehouse.db` by accident.

## Correct stock-level calculations

One product ID represents one unit. Derive current stock from Stock.currentStatus, **not from the number of product records or activity events**.

| Metric | Calculation |
|---|---|
| Warehouse stock | Count OCCUPIED + PENDING_DISPATCH |
| On rack | Count OCCUPIED |
| Off rack, awaiting dispatch | Count PENDING_DISPATCH |
| Not currently in warehouse | Count EMPTY |
| Assigned slots | Count Slot.productID not null |
| Available slots at sync | Count unique slots 1–8 with null productID and assignedAt, fresh isOccupied=false and known occupancyUpdatedAt |

EMPTY may mean unreceived or previously dispatched; do not label every EMPTY record as dispatched. A PENDING_DISPATCH product still belongs to warehouse stock and retains its reserved slot. An unassigned slot may be physically occupied/unidentified or unknown, so it is not automatically available. An assigned EMPTY product may legitimately await first placement without contributing warehouse stock.

Show an optional low-stock alert using a simple dashboard threshold input (default 2 units, clearly editable). Recalculate from the loaded snapshot without querying Firebase. This is a local display setting, not a database update.

## Screen layout

1. **Header:** Warehouse Dashboard, Sync button, last successful sync, loading/error/stale status.
2. **Metric cards:** warehouse units, on-rack units, pending dispatch units, available slots at sync.
3. **Stock graph:** bar chart of OCCUPIED, PENDING_DISPATCH, and EMPTY counts.
4. **Activity graph:** daily event counts grouped by ON_RACK, OFF_RACK, DISPATCHED, and REMOVED; optional date filter operates locally on the snapshot.
5. **Slot monitor:** eight cards in 4×2 layout with product ID, last sensor boolean, occupancyUpdatedAt, freshness and derived state. Fresh vacant/unassigned is Available; vacant/assigned EMPTY is Awaiting placement; occupied/assigned OCCUPIED is Occupied; vacant/assigned PENDING_DISPATCH is Off-rack / reserved; occupied/unassigned is Occupied / unidentified. Null/stale/future observations are Unknown and unavailable. Unexpected combinations warn to Sync again; never invent stock or repair bindings.

   All sections evaluate freshness at the frozen snapshot's `completed_at`, with one shared default of 30 seconds (inclusive), configurable via a local input. Labels explicitly say at-sync, not live. Show last sync and age against current UTC time on each ordinary render, warning when older than the limit. There is no timer or automatic rerender; an idle page retains its visible timestamps until interaction. Only manual Sync obtains new cloud observations.
6. **Tables/tabs:** complete Stocks, Slots, and Activities datasets, with readable timestamps and local product/status/date filters. Sort history by occurredAt and activityId. Include zero-record messages.

Do not present the activity graph as a reconstructed stock-over-time graph. ON_RACK includes first placements and returns, not assignment-only moves, while REMOVED means expired-scan rejection—not necessarily stock reduction. The existing events cannot reliably reconstruct historic inventory balances. Daily event counts are accurate and sufficient for the MVP.

## Data-quality and expiry display

Check and display warnings for missing slots 1–8, out-of-range slots, duplicate product bindings, dangling assignments, populated assignedAt on an unassigned slot, fresh sensor/product-state mismatches, and OCCUPIED/PENDING_DISPATCH without a binding. EMPTY with a vacant binding is valid awaiting placement, not corruption. Do not silently modify or “repair” records. Show all returned rows in tables, even if warnings exist.

Optional expiry indicator: compare expiresOn with the dashboard computer's local date, valid through today; label expired/missing expiry. No GPS or timezone infrastructure. This is display-only and may differ from the phone if device dates differ. Expired in-warehouse products still count until an actual inventory transition removes them.

## Implementation sequence

1. Coordinate the three paginated read-query contracts (including required nullable occupancy fields) with the cloud maintainer. Compilation/deployment and mobile/ESP32 edits are outside this dashboard-only change.
2. Implement the Requests client and pagination tests using fake responses; do not deploy automatically.
3. Implement pure metric and data-quality functions with tests.
4. Build the Streamlit layout and session-state Sync behavior. Keep chart/table rendering separate from Firebase reads.
5. Review public data exposure, deploy approved read queries, and test against the actual Firebase project—not the local SQLite database.
6. Document configuration, startup, query deployment, manual refresh behavior, and known reporting limitations.

## Validation and acceptance

- An empty database renders zero metrics and empty tables without crashing.
- All pages are loaded and record counts match Firebase, including more than one page of activity history.
- OCCUPIED=2, PENDING_DISPATCH=1, EMPTY=4 produces warehouse stock=3, not 7.
- An off-rack product's assigned slot remains reserved and displays its ID.
- REMOVED events and repeated ON_RACK events do not directly alter computed stock.
- Unreported/stale/future observations are unavailable; occupied unassigned is unidentified. EMPTY awaiting placement is valid and never counted as warehouse stock.
- Shared freshness boundary/configuration changes cards, warnings and availability consistently, not stock totals. Observation timestamps and at-sync labels remain visible; an aged snapshot warns on render without polling.
- Low-stock/occupancy-freshness thresholds and local filters cause no network calls.
- Only Sync fetches cloud data; last-sync time advances only after success.
- Failed/partial sync retains the previous complete snapshot and last-success time.
- Verify a phone/ESP32 change does not appear until Sync is clicked; then all metrics/charts/tables update.
- Review the client code and request logs: queries only, no mutation calls and no database writes.
- Run unit tests and a Streamlit startup/manual UI check. Report local versus live Firebase tests separately.

## Out of scope

Authentication UI, stock adjustments, product/slot editing, dispatch controls, automatic syncing, offline persistent database, historical stock reconstruction, and changes to phone/ESP32 inventory behavior. Dashboard implementation is complete; Firebase deployment and live device acceptance are separate maintainer steps.

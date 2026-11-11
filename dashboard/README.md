# Read-only Warehouse Dashboard

Local Streamlit reporting for Firebase Data Connect. No Node server, custom backend,
SQLite, mobile/ESP32 changes, writes, subscriptions, or automatic cloud reads.

## Run

Use Python 3.11–3.13 (validation uses 3.11). From `dashboard/`:

```sh
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m streamlit run app.py
```

Install the pinned dependencies into this environment, not system Python. Opening
Streamlit shows **No data loaded. Click Sync.** Configuration is not needed until
Sync. Only clicking Sync makes cloud requests; local filters and threshold changes
operate on the session snapshot. Closing the session loses the in-memory copy.

## Configuration

Create `dashboard/.streamlit/secrets.toml` locally (ignored by Git):

```toml
[firebase]
api_key = "your Firebase public web API key"
app_id = "your Firebase app ID"
project = "smart-warehouse-3171e"
region = "asia-southeast1"
service = "smart-warehouse-service"
connector = "example"
```

Alternatively set environment variables `FIREBASE_API_KEY`, `FIREBASE_APP_ID`,
`FIREBASE_PROJECT`, `FIREBASE_REGION`, `FIREBASE_SERVICE`, `FIREBASE_CONNECTOR`.
The last four default to the values above. Secrets take precedence per field.
Run Streamlit from `dashboard/` so its per-directory secrets file is discovered.
Do not use service-account keys, database passwords, or committed credentials.
The API key and app ID are public Firebase client configuration, not read-only
access controls. No configuration values are displayed in the UI or request errors.

## Connector contract — deploy separately, after security review

**PUBLIC operations expose the entire inventory and activity history to anyone
able to call the connector.** The existing connector also contains write operations;
this dashboard not calling them does not secure the connector. Review Firebase
API restrictions, billing/quotas, and authentication before production deployment.
Each manual Sync downloads all rows, with corresponding network/read costs.

The coordinated query definitions live in
`firebase/dataconnect/example/queries.gql`; the detailed compiler/emulator contract
is `firebase/dataconnect/DASHBOARD-CONTRACT.md`. This Python dashboard work changes
only `dashboard/`, and does not compile, deploy, or migrate Firebase resources.

| operationName | response array (`data`) | ascending key / nullable `after` type | fields |
| --- | --- | --- | --- |
| `DashboardStocks` | `stocks` | `productID` / `String` | productID, currentStatus, statusUpdatedAt, description, expiresOn |
| `DashboardSlots` | `slots` | `slotId` / `Int` | slotId, productID, assignedAt |
| `DashboardActivities` | `activities` | `activityId` / `Int` | activityId, productID, occurredAt, activityType |

All operations declare `$limit: Int!`, with **no default**. The client always sends
`{"after": null, "limit": 100}` on the first page, then the last key as `after`.
These queries use fixed parameterized read-only SELECTs with
`WHERE ($1 IS NULL OR key > $1)` (with appropriate SQL casts), ascending key order,
and a bound limit. No client SQL or arbitrary GraphQL is accepted. This explicitly
omits the first-page restriction: it does **not** rely on `gt: null` behaving like
no filter. The installed compiler does not support `where_expr` and rejects
explicit null in a generated `gt` filter at runtime; do not substitute either.

The final page has fewer than 100 rows; an exact boundary requires an extra empty
page. Identical duplicate primary keys are deduplicated; conflicting duplicates,
unordered results, and stalled cursors fail the entire sync. There is no pageInfo,
opaque cursor, or total count. All selected properties must exist, with explicit
nulls for nullable fields. A null result list is a failure, not an empty table.

A connector maintainer must compile/review the coordinated queries and explicitly
deploy the approved connector before live use. Older deployments using `pageSize`
are incompatible. Preserve unrelated operations. A typical deployment, run by the
maintainer from `firebase/`, is:

```sh
firebase deploy --only dataconnect
```

Review what this command will deploy: it can include schema/service changes as
well as connectors. See the Firebase contract for local compiler/emulator checks;
no Firebase deployment is performed by this dashboard or its Python tests.

Requests POST only to:

```text
https://firebasedataconnect.googleapis.com/v1/projects/{project}/locations/{region}/services/{service}/connectors/{connector}:executeQuery?key={api_key}
```

Body: `{"operationName": "DashboardStocks", "variables": {"after": null, "limit": 100}}`.
Headers: `Content-Type: application/json`, `x-firebase-gmpid: {app_id}`.
Expected body: `{"data": {"stocks": [...]}}` (or `slots` / `activities`).
Any HTTP failure, invalid JSON, GraphQL error, missing field, invalid enum/date,
or malformed page is an error, not an empty database. Timeouts are finite
(5-second connect, 30-second read per request); redirects are rejected.

## Reporting behavior

- A complete, validated three-table result replaces `st.session_state.snapshot`
  atomically. Failure retains the old snapshot and its successful-sync timestamp.
  The busy guard prevents overlapping sync work in the same session.
- This is a manually refreshed reporting copy, not inventory authority. Separate
  pages/tables may observe different database moments; simultaneous inventory
  changes can be missed or produce quality warnings until the next manual Sync.
- Warehouse units = OCCUPIED + PENDING_DISPATCH. EMPTY is **not** synonymous with
  dispatched. Pending dispatch keeps its slot reserved. Expired stock still counts.
- Unassigned slots count only existing IDs 1–8 with both productID and assignedAt
  null. Missing/inconsistent cards are Unknown, never assumed available. Tables
  retain all unique returned records, including out-of-range/invalid bindings;
  data-quality warnings do not repair or hide them.
- Local product filter applies to all tables; status filters the stock table;
  activity type/date filter the event table and chart. Metrics and slot monitor
  always reflect the full snapshot. Activity dates and timestamps use UTC.
- Low-stock threshold defaults to 2, with an alert at or below the threshold.
  Expiry compares against the dashboard computer's local date, valid through today.
- Activity chart shows daily event counts, **not** stock-over-time. ON_RACK may
  mean receipts/returns/moves; REMOVED means expired-scan rejection, not necessarily
  stock reduction. Events never drive inventory totals.

## Tests and live acceptance

```sh
# From dashboard/, uses unittest and unittest.mock; no pytest dependency
.venv/bin/python -m unittest discover -v
```

Tests cover pagination (including integer cursors and exact page boundaries),
empty/malformed/error responses, enum/date validation, key deduplication,
status-based totals, quality warnings, expiry, failure-safe session state, and
headless Streamlit rendering. Streamlit AppTest checks initial/rerun/filter
behavior without Firebase access, successful Sync, empty data, and failed Sync
retaining the previous snapshot. Tests use fake public config only.

Validated locally with the pinned requirements on Python 3.11. No Python test calls
live Firebase. Headless AppTest is not a visual browser/device test.

After approved deployment, manually verify real multi-page record counts against
Firebase; change stock via the phone/ESP32, confirm the UI stays unchanged until
Sync, then confirm all sections update. Check browser layout/spinner and request
logs for reads only. Offline tests do not establish live permissions or
transactional consistency.

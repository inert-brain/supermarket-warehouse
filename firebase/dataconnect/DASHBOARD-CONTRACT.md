# Dashboard read-query contract

These three operations are **PUBLIC, unauthenticated prototype reads**. They expose all stock records, slot assignments (including out-of-menu slots), and activity history. Review this exposure before any approved deployment. Public Firebase configuration is not access control. Nothing in this change is deployed. Sensor/assignment mutation semantics and the additive nullable occupancy schema are documented in `LOCATION-CONTRACT.md`.

Operations live in `example/queries.gql`, connector `example`, service `smart-warehouse-service`, region `asia-southeast1`.

## Request and pagination

POST only to the connector's `:executeQuery` endpoint with:

```json
{"operationName":"DashboardStocks","variables":{"after":null,"limit":100}}
```

| Operation name | GraphQL variable definitions | Response list | Ascending unique key |
| --- | --- | --- | --- |
| `DashboardStocks` | `$after: String, $limit: Int!` | `data.stocks` | `containerID` |
| `DashboardSlots` | `$after: Int, $limit: Int!` | `data.slots` | `slotId` |
| `DashboardActivities` | `$after: Int, $limit: Int!` | `data.activities` | `activityId` |

- Always send both variables. First page: `{"after":null,"limit":100}`. No variable defaults are defined; `limit` is required. The dashboard contract uses a positive bounded limit of 100, not a server-side maximum of 100.
- Subsequent page: set `after` to the last returned row's key, preserving its JSON type (string for stocks, integer for slots/activities). For example, `{"after":"product-100","limit":100}` or `{"after":100,"limit":100}`.
- `after` is exclusive: only keys strictly greater than it are returned, in database ascending key order. Null means no key restriction, with no sentinel assumption about the smallest valid key.
- Stop on a successful page shorter than `limit` (including an empty list). A full final page requires one more request to discover the empty page. Deduplicate by the same key.
- A response error, null/missing list, or malformed row is a failure, not an empty database. Check HTTP/GraphQL errors and row types. No total count, opaque cursor, or `pageInfo` is returned.
- Pages and the three operations do not provide a consistent cross-table snapshot during concurrent inventory changes.

## Exact row shapes

All listed properties are present on successful rows; nullable values are explicit JSON `null`.

```text
stocks: [{
  containerID: string,
  currentStatus: "EMPTY" | "OCCUPIED" | "PENDING_DISPATCH",
  statusUpdatedAt: timestamp string,
  description: string | null,
  expiresOn: "YYYY-MM-DD" | null
}]

slots: [{
  slotId: integer,
  containerID: string | null,
  assignedAt: timestamp string | null,
  isOccupied: boolean | null,
  occupancyUpdatedAt: timestamp string | null
}]

activities: [{
  activityId: integer,
  containerID: string,
  occurredAt: timestamp string,
  activityType: "ON_RACK" | "OFF_RACK" | "DISPATCHED" | "REMOVED"
}]
```

## Occupancy interpretation

For the school-demo scan rules, a slot is **demo-available** when both assignment
fields are null and occupancy is false or null (`IS NOT TRUE`), regardless of
observation time. Null occupancy is Unknown, not confirmed vacancy; old readings
may be labelled old, never live. Timestamps are display/debugging only, not action
gates. Known occupied unassigned slots are unidentified and not selectable.
Assigned EMPTY + false/null means awaiting placement; assigned pending + false/null
means reserved/off-rack. Neither is available to another product. Reassignment
also permits OCCUPIED + false/null and preserves that stock status until a sensor
report reconciles it; this temporary mismatch is an accepted demo limitation.
Warehouse count remains OCCUPIED + PENDING_DISPATCH, not the number of physical
true readings. Malformed assignments should warn/refresh, not silently clear
bindings. No dashboard read-query or sensor behavior changes are required.

## Compiler compatibility and SDK

Verified with Data Connect 3.4.25 (Firebase CLI 15.35.0). Its generated list queries do not support `where_expr` or a filter `_expr`; binding `gt: $after` compiles but rejects an explicit null at runtime. The dashboard operations therefore use fixed, parameterized read-only `_select` statements with `WHERE ($1 IS NULL OR key > $1)`, explicit parameter casts, `ORDER BY key ASC`, and `LIMIT $2`. Client values are bound parameters, never interpolated SQL. Generated slot-filter operations also select both nullable occupancy fields.

The SDK exports `dashboardStocks`, `dashboardSlots`, and `dashboardActivities` and their corresponding `Ref` helpers. `_select` responses are generated as `unknown[] | null` rather than typed table rows; consumers must validate against the row contract above. The runtime names remain `stocks`, `slots`, and `activities`.

## Local validation (no deployment)

From `firebase/dataconnect/`, using the installed Data Connect binary:

```sh
~/.cache/firebase/emulators/dataconnect-emulator-3.4.25 build -config_dir .
~/.cache/firebase/emulators/dataconnect-emulator-3.4.25 sdk generate -config_dir .
node check-generated-sdk.cjs
DASHBOARD_TEST_DISPOSABLE=yes firebase emulators:exec --config emulator-tests.firebase.json --only dataconnect --project demo-warehouse 'node emulator-dashboard.test.cjs'
node check-generated-sdk.cjs
```

The final SDK check applies this repository's existing generated ambient-enum workaround and runs strict TypeScript validation. Emulator startup may regenerate the SDK, which is why the check follows it too.

The test refuses nonempty tables and database overrides. It writes fixtures directly to a disposable local emulator database, then calls only read queries. It verifies empty datasets, null first-page cursors, exact response fields and nullable values (including null/true/false occupancy and observation times), valid EMPTY awaiting-placement bindings, date/timestamp values, page sizes 100/100/5 over 205 rows per table, out-of-menu slots, ascending exclusive keys without gaps or duplicates, terminal empty pages, and rejection of a missing required limit. This is local validation, not a live Firebase test.

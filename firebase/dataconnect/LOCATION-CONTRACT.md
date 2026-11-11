# Occupancy / assignment connector contract

Local implementation of `esp32/plan.md` with the relaxed scan rules from
`app/UI/location/mvp-scan-plan.md`. No cloud migration or deployment is performed.
Only this Data Connect subtree is changed; app, firmware, and dashboard callers must
be coordinated separately. All operations are **PUBLIC, unauthenticated prototype**
operations. Anyone who can call the connector can read/write inventory.

Connector `example`, service `smart-warehouse-service`, region `asia-southeast1`.
Product IDs are exact strings; command slot IDs are integers 1–8. There are no
versions, operation ledger, quantity model, custom server, or expiry service.

## Schema and meaning

`Slot` retains its unique nullable `productID` binding, foreign key and `assignedAt`.
It adds nullable `isOccupied: Boolean` and `occupancyUpdatedAt: Timestamp`.
Existing/unreported rows remain **Unknown**, not confirmed vacant. The demo
nevertheless permits false/null occupancy for assignment/change. Dispatch requires explicitly false occupancy; null is not proof of being off rack.
Only accepted sensor reports set observation fields, using server `request.time`.

- `EMPTY`: not counted; may be assigned and awaiting first physical placement.
- `OCCUPIED`: on rack, counted once.
- `PENDING_DISPATCH`: off rack but reserved and still counted once.
- Demo-available target: no binding/time and `isOccupied` false **or null**
  (`is_occupied IS NOT TRUE`). Unknown is selectable, not proven physically vacant.
- Observation timestamps are display/debugging only: absent, old, or future
  timestamps never gate assignment, reassignment, or dispatch.
- Vacant assigned `EMPTY`: awaiting placement, not available to another product.
- Vacant assigned pending: reserved, not available to another product.
- Occupied unassigned: unidentified; no identity or receipt is invented.
- Known occupied (`isOccupied=true`): always blocked for assignment/change/dispatch.
- Assignment/status mismatches can persist until a subsequent sensor report;
  reassignment preserves EMPTY, OCCUPIED, or PENDING_DISPATCH exactly.

## Exact mutation inputs and successful JSON data

POST to the connector's `:executeMutation` endpoint using
`{"operationName":"ReportSlotOccupancy","variables":{"slotID":1,"occupied":true}}`.
The response envelope contains `data` below. Check HTTP **and GraphQL errors**;
never interpret a partial/error response as success.

| Operation | GraphQL variables | Successful `data` |
|---|---|---|
| `ReportSlotOccupancy` | `$slotID: Int!, $occupied: Boolean!` | `{observation: 1, query: {slot: SlotObservation}}` |
| `AssignProductToSlot` | `$productID: String!, $targetSlotID: Int!` | `{binding: 1}` |
| `ChangeAssignedSlot` | `$productID: String!, $sourceSlotID: Int!, $targetSlotID: Int!` | `{binding: 1}` |
| `DispatchProduct` | `$productID: String!, $sourceSlotID: Int!` | `{dispatch: 1}` |
| `RecordExpiredScan` | `$productID: String!, $sourceSlotID: Int` | `{query: {stock: {currentStatus}, bindings: [{slotId, assignedAt}]}, activity_insert: {activityId: integer}}` |

`SlotObservation` has exactly:

```text
{
  slotId: integer,
  productID: string | null,
  assignedAt: timestamp string | null,
  isOccupied: boolean,
  occupancyUpdatedAt: timestamp string,
  stock: {productID: string, currentStatus: "EMPTY" | "OCCUPIED" | "PENDING_DISPATCH",
          statusUpdatedAt: timestamp string} | null
}
```

The report's slot is the **post-write state inside the same transaction**, not
an additional client request. `observation=1` means a slot report was accepted,
not that a product transition occurred. `_execute` SDK counts are generated as
optional `number | null`; runtime success is checked to equal 1. Nullable SDK
fields may be optional in TypeScript even though runtime JSON includes nulls.

### ReportSlotOccupancy

The caller supplies **no product ID, status, or activity type**. The operation
locks the slot, resolves its stored assignment and conditionally updates stock:

| Observation | Stored product status | Result | Activity |
|---|---|---|---|
| occupied | EMPTY or PENDING_DISPATCH | OCCUPIED | ON_RACK |
| vacant | OCCUPIED | PENDING_DISPATCH | OFF_RACK |
| occupied | OCCUPIED | unchanged | none |
| vacant | EMPTY or PENDING_DISPATCH | unchanged | none |
| either | no assignment | no product change | none |

Every report refreshes observation time, including repeated states. No-op paths
preserve status time and create no activities. Product state, **not a boolean
edge**, decides reconciliation. Binding/time are preserved. Sensor reports
never reject expiry, including expired first receipt/return. Invalid/missing
slots or malformed assignment pairs fail `INVALID_OR_INCONSISTENT_SLOT`.

### Assignment and change

`AssignProductToSlot` requires an existing EMPTY, unassigned product and an
unassigned target with null assignment time and occupancy false/null. It binds
and sets `assignedAt`, **without changing stock, status time, observations, or
activities**. An already-bound target is rejected, including a repeated assignment
to the same slot; use `ChangeAssignedSlot` for a checked keep-current-slot no-op.
A product already bound elsewhere is rejected by the unique assignment index.
Failed eligibility is `STALE_STOCK_OR_TARGET` (constraints may report their own
errors). The legacy error name does not indicate observation-age validation.

`ChangeAssignedSlot` locks source/target in slot-ID order, requires both to be
not known occupied (`IS NOT TRUE`), exact source binding/non-null assignment time,
and product EMPTY, OCCUPIED, or PENDING_DISPATCH. A distinct target must be
unassigned with null assignment time. It atomically clears both source binding
fields and binds target with request time, preserving stock status/time, both
observations, and all activities. Even OCCUPIED may move when the saved source
occupancy is false/null; only subsequent sensor reports reconcile product state.
Same-source/target is a checked no-op preserving assignment time, subject to the
same occupancy/source checks. Failure: `STALE_STOCK_OR_SLOTS`. It never overwrites
another reservation.

### Dispatch and expired scan

Dispatch requires matching assignment/non-null assignment time, stock in any
of EMPTY/OCCUPIED/PENDING_DISPATCH, and explicitly false source occupancy
(`is_occupied = false`), regardless of observation time or stock-status lag.
Unknown/null occupancy is rejected, not treated as proof of being off rack.
Atomically set stock EMPTY/time, clear **only** binding and assignedAt, and insert
DISPATCHED. Preserve observation boolean/time and stock/history rows. A saved
true occupancy or a synchronized return prevents dispatch. Failure:
`STALE_STOCK_OR_SOURCE`. A repeat request fails because the source binding is
now gone, without another DISPATCHED log. Derive warehouse delta from the prior
status: EMPTY contributes 0; OCCUPIED/PENDING_DISPATCH contribute −1. No fixed
decrement, version, or ledger is introduced.

`RecordExpiredScan` preserves the existing REMOVED logging policy: with no
source require EMPTY and no binding; with a source require exactly that valid
binding/time in 1–8. Assigned EMPTY is now valid too. No stock, assignment,
observation, or timestamp changes. Failure: `STALE_OR_INCONSISTENT`.
REMOVED means expired-scan rejection, **not physical disposal**. Expiry
eligibility remains a phone-local date decision; the connector does not enforce it.
Repeated expired-scan requests intentionally create repeated logs.

`PlaceProduct`, `MoveProduct`, `TakeOffRack`, and `ReturnProduct` are removed
from connector and generated SDK, not retained as conflicting write paths.

## Read contracts

Every slot returned by `GetSlotBindings`, `GetProductContext`, `GetSlotMenu`,
and both slot arrays in `GetLocationSnapshot` includes `slotId`, `productID`,
`assignedAt`, **`isOccupied`, `occupancyUpdatedAt`**. Both observation fields
are nullable. `GetSlotMenu` and snapshot `rackSlots` additionally join nullable
`stock {productID, currentStatus}`. Product context/bindings include all exact
product assignments, even outside the menu; menu/rack queries return only
existing slots 1–8. Array order is unspecified; missing rows are not synthesized.

Snapshot and context stock fields remain `productID, description, expiresOn,
currentStatus, statusUpdatedAt`. `GetStockByProductID` remains nullable
`stock {productID, description, expiresOn}`. Query fields/pages can observe
different concurrent states: refresh/fail closed rather than invent a repair.
Use server-only reads (`QueryFetchPolicy.SERVER_ONLY`).

All dashboard `_select` row shapes, pagination, and SDK `unknown[] | null`
validation requirements are in `DASHBOARD-CONTRACT.md`.

## Atomicity, compiler compatibility, limitations

All writes use `@transaction`. Fixed parameterized `_execute` SQL supports
modifying CTEs in Data Connect **3.4.25** (Firebase CLI **15.35.0**). PostgreSQL
CASE results are explicitly cast to the actual generated `stock_status` and
`activity_type` enum types. Slot locks protect assignment interpretation against
other connector writers; status predicates gate transition/activity creation.
Affected-row checks and any constraint/activity failure roll back all writes.

Compiler caveat: an independent read following `_execute` can be incorrectly
merged into a scalar SELECT. The report's `slotId_expr` explicitly depends on
`response.observation`, forcing a separate post-write statement in the same
transaction. Keep this dependency; the generated-SDK emulator test covers it.
No unsupported conditional directives or client-side multi-request transition is used.

This is a school-demo MVP, not a physical dispatch interlock. Unknown sensor
values are accepted for assignment/change only; old readings are accepted for all
actions and can disagree with physical state.
Sensors cannot verify identity; a physical return after the last report can race
a dispatch. Assignment works without ESP32 connectivity, but physical receipt
confirmation and stock reconciliation still require subsequent sensor reports.
No version/ledger means no ABA protection, offline edge replay, or exactly-once
request reconciliation. Periodic current-state reports recover connectivity;
refresh after uncertain command results. PUBLIC access is not authorization.

## Local validation

From `firebase/dataconnect/`, using existing installed dependencies only:

```sh
~/.cache/firebase/emulators/dataconnect-emulator-3.4.25 build -config_dir .
~/.cache/firebase/emulators/dataconnect-emulator-3.4.25 sdk generate -config_dir .
node check-generated-sdk.cjs
XDG_CONFIG_HOME=/tmp/warehouse-firebase-config CI=true NODE_PATH=../../app/UI/node_modules LOCATION_TEST_DISPOSABLE=yes firebase emulators:exec --only dataconnect --project demo-warehouse --config emulator-tests.firebase.json 'node emulator-mutations.test.cjs'
XDG_CONFIG_HOME=/tmp/warehouse-firebase-config CI=true DASHBOARD_TEST_DISPOSABLE=yes firebase emulators:exec --only dataconnect --project demo-warehouse --config emulator-tests.firebase.json 'node emulator-dashboard.test.cjs'
node check-generated-sdk.cjs
```

No `dataDir` or database override: tests require empty disposable in-memory
PGlite tables and explicit opt-in, never saved `.dataconnect` or cloud data.
Mutation tests use the real generated SDK, covering transitions/no-ops,
unknown/unidentified observations, null/false occupancy with absent/old/future
timestamps, awaiting placement, status-preserving EMPTY/OCCUPIED/PENDING moves,
same-slot no-ops, known-occupied blocking, missing/malformed/reserved slots,
unique binding, all-status explicitly-false dispatch/duplicate rejection, null/true dispatch rejection, dispatch after return,
expired logging, forced assignment/status/slot/activity constraint rollback and
concurrent smoke cases.
Dashboard tests cover null/true/false occupancy and 205-row keyset pagination.
SDK checks compile the generated declarations plus `sdk-contract.test.ts`
strictly with `skipLibCheck=false`, remove the generator's known ambient-enum
semicolon defect, and reject obsolete manual write exports.

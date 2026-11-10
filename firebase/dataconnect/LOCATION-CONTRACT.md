# Location connector contract: single-phone MVP

Local source definitions for direct Phone → Firebase Data Connect → PostgreSQL.
This change has not deployed a connector, migrated a cloud database, or removed
any cloud resources. All operations are `PUBLIC`: anyone able to call this
connector can read and modify inventory. Use only in an isolated prototype.

## Schema

Keep the original enums:

- `StockStatus`: `EMPTY`, `OCCUPIED`, `PENDING_DISPATCH`.
- `ActivityType`: `ON_RACK`, `OFF_RACK`, `DISPATCHED`, `REMOVED`.

`Stock` and `Slot` have no version fields. There is no `LocationOperation`
table or operation lookup. The existing unique slot-to-product assignment and
foreign keys remain. Product IDs are exact strings, not numbers.

## Reads

- `GetLocationSnapshot(productID)` returns nullable `stock { productID,
  description, expiresOn, currentStatus, statusUpdatedAt }`, `rackSlots` (existing
  IDs 1–8 with `slotId`, `productID`, `assignedAt`, nullable
  `stock { productID, currentStatus }`), and `productBindings` (all exact-product
  bindings, including outside 1–8, with `slotId`, `productID`, `assignedAt`).
- `GetProductContext(productID)` returns the same stock fields and all matching
  bindings as `slots { slotId, productID, assignedAt }`.
- `GetSlotMenu` returns existing slots 1–8 with `slotId`, `productID`,
  `assignedAt`, and nullable `stock { productID, currentStatus }`.
- `GetSlotBindings` retains `slots { slotId, productID }` for existing IDs 1–8.
- `GetStockByProductID(productID)` retains nullable
  `stock { productID, description, expiresOn }`.

Array order is unspecified. Missing slot rows are not synthesized; missing stock
is not `EMPTY`. Nullable fields can be null. Dates and timestamps use generated
`DateString` and `TimestampString` types. Request server-only reads
(`QueryFetchPolicy.SERVER_ONLY`), validate assignment pairs and joined stock,
and refresh/fail closed on inconsistency. Query fields are advisory and need
not observe one consistent database snapshot. Neither timestamp is a concurrency
token.

## Six transactional mutations

The generated SDK exports lower-camel-case functions (for example,
`placeProduct(dc, { productID, targetSlotID })`). Inputs are only those below:
no operation IDs, expected versions, caller-selected statuses, or activity types.

| Mutation | Variables | Required status → result | Slot effect | Activity |
|---|---|---|---|---|
| `PlaceProduct` | `productID: String!`, `targetSlotID: Int!` | `EMPTY` → `OCCUPIED` | Bind empty target, set `assignedAt` | `ON_RACK` |
| `TakeOffRack` | `productID: String!`, `sourceSlotID: Int!` | `OCCUPIED` → `PENDING_DISPATCH` | Preserve reservation and `assignedAt` | `OFF_RACK` |
| `ReturnProduct` | `productID: String!`, `sourceSlotID: Int!` | `PENDING_DISPATCH` → `OCCUPIED` | Preserve reservation and `assignedAt` | `ON_RACK` |
| `MoveProduct` | `productID: String!`, `sourceSlotID: Int!`, `targetSlotID: Int!` | `OCCUPIED` or `PENDING_DISPATCH` → `OCCUPIED` | Clear source, bind different empty target | `ON_RACK` |
| `DispatchProduct` | `productID: String!`, `sourceSlotID: Int!` | `PENDING_DISPATCH` → `EMPTY` | Clear source, retain stock row | `DISPATCHED` |
| `RecordExpiredScan` | `productID: String!`, optional/nullable `sourceSlotID: Int` | Unchanged | Unchanged | `REMOVED` |

All six use `@transaction`. Inventory changes use conditional stock updates and
require exactly one affected row (`STALE_STOCK` on failure). Slot IDs must be
1–8. A source must match the exact product with non-null `assignedAt`
(`STALE_SOURCE`); a target must have both `productID` and `assignedAt` null
(`STALE_TARGET`). Take-off and return check the reservation using a matching
no-op slot update, preserving its timestamp. Move clears the source before
assigning the target to respect the unique assignment constraint. Same-slot
move fails and rolls back; the client should treat occupied same-slot selection
as a no-op and pending same-slot selection as return.

The unique assignment constraint rejects placing a product already bound to
another slot, even when its status is incorrectly `EMPTY`. Every failed check,
constraint, or activity insert rolls back all earlier writes, including status
and assignment timestamps. Mutation responses contain update counts and the
inserted activity key, not a ledger receipt.

`RecordExpiredScan` reads the stock and all exact-product bindings within its
transaction. With no source, it requires `EMPTY` and no binding. With a source,
it requires `OCCUPIED` or `PENDING_DISPATCH`, exactly that binding in 1–8, and a
non-null assignment timestamp. Otherwise it fails with `STALE_OR_INCONSISTENT`.
It inserts only `REMOVED`; stock, status timestamp, and slots are unchanged.
`REMOVED` means a rejected expired scan, not confirmed physical disposal.
This validation read does not lock inventory rows.

## Timestamps, expiry, and MVP limits

Status changes set `statusUpdatedAt`, new assignments set `assignedAt`, and
activities set `occurredAt` using Firebase `request.time`. Released slots clear
both assignment fields. Take-off/return preserve the original assignment time.

Expiry decisions belong to the phone's local calendar date. The connector does
not inspect `expiresOn` or enforce expiry; wrong clocks and modified clients can
bypass that policy. No expiry server, SQL eligibility view, or timezone service
is introduced.

This is a single-phone, state-checked MVP, **not** a durable idempotency protocol:

- Immediate repeated inventory actions generally fail their status/binding
  checks, but a state that changes and later returns to the same values is not
  distinguishable from the original state. Old confirmations can become valid
  again; refresh and reconfirm after state changes.
- Every accepted expired-scan call inserts another activity. Suppress repeated
  camera callbacks on the phone; do not blindly retry a timed-out scan.
- A network error does not prove rollback. Refresh after an uncertain result;
  current state is not proof of which request committed. There is no exact-key
  operation reconciliation or exactly-once guarantee.
- Public access is not authorization, and tests are not proof of multi-phone
  concurrency or deployed-cloud behavior.

## Local validation

Use installed Firebase CLI/emulator tooling plus existing `pg` (backend) and
Firebase (UI) dependencies; this test does not edit either application. From
`firebase/dataconnect/`:

```sh
LOCATION_TEST_DISPOSABLE=yes firebase emulators:exec --only dataconnect --project demo-warehouse --config emulator-tests.firebase.json 'node emulator-mutations.test.cjs'
node check-generated-sdk.cjs
```

The test-only config has **no `dataDir`**: Firebase creates an in-memory PGlite
database instead of opening `.dataconnect/pgliteData`. Do not supply a
`FIREBASE_DATACONNECT_POSTGRESQL_STRING` override. The test refuses nonempty
fixtures or a missing disposable opt-in and verifies removed schema additions,
all six transitions, read results, timestamp preservation, invalid state/binding
rollback, and forced activity-insert rollback for every mutation. Small parallel
submission tests are smoke coverage only.

Run `node check-generated-sdk.cjs` after SDK generation or emulator tests (the
emulator also regenerates the SDK). It uses the existing UI TypeScript/Firebase
dependencies, trims generated trailing whitespace, and removes the extra `;`
that generator 3.4.25 emits after ambient enum declarations. Then it checks the
removed API surface and strictly compiles declarations with `skipLibCheck: false`.

See `LOCATION-MIGRATION.md` for parent-owned cloud cleanup; do not deploy or
migrate as part of this local task.

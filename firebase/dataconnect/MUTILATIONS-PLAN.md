# Six direct Firebase mutations: simplified MVP

This plan supersedes the earlier version-token/operation-ledger design. The
single phone calls Firebase Data Connect directly; no UI/backend changes,
custom command server, expiry server, cloud migration, or deployment belong to
this connector-only task.

## Scope

- Remove `Stock.version`, `Slot.version`, and `LocationOperation`.
- Keep original `StockStatus`/`ActivityType`, timestamps, and assignment keys.
- Keep existing reads and the advisory `GetLocationSnapshot`, without versions.
- Remove `GetLocationOperation` and all operation-ID/version inputs.
- Implement exactly six `@transaction` mutations with conditional stock status
  and null/assigned slot checks; require one affected row per expected update.
- Regenerate the connector SDK and validate compilation/emulator behavior.

## State and activity mapping

| Mutation | Input slots | Required stock | Result | Slot effect | Activity |
|---|---|---|---|---|---|
| `PlaceProduct` | target | `EMPTY` | `OCCUPIED` | Bind empty target | `ON_RACK` |
| `TakeOffRack` | source | `OCCUPIED` | `PENDING_DISPATCH` | Preserve reservation | `OFF_RACK` |
| `ReturnProduct` | source | `PENDING_DISPATCH` | `OCCUPIED` | Preserve reservation | `ON_RACK` |
| `MoveProduct` | source, different target | `OCCUPIED` or `PENDING_DISPATCH` | `OCCUPIED` | Clear source, bind empty target | `ON_RACK` |
| `DispatchProduct` | source | `PENDING_DISPATCH` | `EMPTY` | Clear source, retain stock | `DISPATCHED` |
| `RecordExpiredScan` | optional source | Consistent status/binding | Unchanged | Unchanged | `REMOVED` |

Every mutation also takes the exact `productID: String!`. Slot variables use
`sourceSlotID` / `targetSlotID`; allowed IDs are 1–8. No caller chooses the next
status or activity type. All accepted writes for one action commit together.

## Transaction rules

1. Conditional stock updates include the product ID and allowed current status.
2. Source updates require the exact product binding and non-null `assignedAt`.
   Take-off/return perform a matching no-op update to check the reservation.
3. Targets require both assignment fields null. The unique product assignment
   constraint also rejects already-bound placement.
4. Move releases the source before binding the target. Releases clear both
   `productID` and `assignedAt`; new assignments use `request.time`.
5. Status changes set `statusUpdatedAt` using `request.time`. Activity timestamps
   use the same trusted request time. Take-off/return retain `assignedAt`.
6. Every expected update must affect exactly one row. A failed check, slot
   constraint, or activity insert rolls back all earlier writes and timestamps.
7. Expired scans validate stock/binding consistency and insert only `REMOVED`;
   they never change stock or slot rows. This validation is a read, not a lock.

## Deliberate simplifications

The phone decides expiry using its local calendar date (valid through the
expiration date); there is no server-side expiry check. `REMOVED` records a
rejected expired scan, not confirmed physical disposal.

No operation ledger, exactly-once promise, or expected-version protocol remains.
State checks can reject immediate duplicates, but cannot detect a state cycling
back to previous values. Repeated expired-scan calls each log an event. The
phone must suppress duplicate camera callbacks, refresh/reconfirm after state
changes, and avoid blind retries on uncertain outcomes. Client integration is
parent-owned and outside this subtree's implementation scope.

`PUBLIC` reads/writes are only suitable for an isolated prototype. Transactions
protect database consistency, not authorization or phone clock accuracy.

## Validation and handoff

Compile the local schema/connector with the Data Connect tooling and regenerate
`example/generated/`. Type-check the generated SDK. Use the fresh in-memory
emulator configuration described in `LOCATION-CONTRACT.md`; do not open saved
emulator fixtures or touch cloud data. Tests inspect Stock, Slot, and Activity:

- All six state/activity mappings, including moving a pending reservation.
- Original assignment time retained on take-off/return.
- Both assignment fields cleared on move/dispatch; stock not deleted.
- Wrong status, source, occupied/malformed/missing target, and out-of-range IDs.
- Already-bound placement and same-slot move rejection.
- Status/source/target rollback and activity-insert rollback for every mutation.
- Expired scans in empty/occupied/pending states without inventory changes.
- Reads without version fields; no version columns or ledger in fresh schema.
- Small simultaneous-submission smoke tests, not a multi-phone safety proof.

Cloud cleanup is authorized but must be executed by the parent, not this task.
See `LOCATION-MIGRATION.md` for the handoff and `LOCATION-CONTRACT.md` for exact
SDK variables, responses, and retry limitations. No UI/backend files are edited.

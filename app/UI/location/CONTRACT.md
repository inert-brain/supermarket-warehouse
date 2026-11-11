# Direct Data Connect contract — occupancy vs assignment MVP

This is the active app contract, superseding the historical plans in this directory and `../plan.md`. It implements the UI portion of [mvp-scan-plan.md](mvp-scan-plan.md), including relaxed saved-occupancy rules. The Firebase owner must align/deploy the additive nullable slot fields, query selection, assignment mutations, and sensor transactions separately. No Firebase, hardware, or dashboard changes/deployment are made by this UI change. Local tests do not establish deployed transaction or sensor behavior.

The app uses the Firebase web app and Data Connect `example` connector, `smart-warehouse-service`, `asia-southeast1`, configured in `receiving.ts`. No local command server or generated SDK dependency is required.

## Reads

Server-only `GetLocationSnapshot(productID: String!)` must select/alias these fields:

```text
{
  stock: null | { productID, currentStatus, expiresOn, description },
  rackSlots: [{ slotId, productID, assignedAt,
                isOccupied: Boolean | null, occupancyUpdatedAt: Timestamp | null,
                stock: null | { productID, currentStatus } }],
  productBindings: [{ slotId, productID, assignedAt }]
}
```

`rackSlots` contains all eight slots 1–8, including unassigned slots. `productBindings` contains every binding of the exact requested product, including any out-of-range bindings so they cannot be hidden by the rack filter. `stock.currentStatus` and each assigned slot's joined stock status are required. Explicit null occupancy fields represent an unreported slot; missing fields are a contract error, not vacancy. `assignedAt` is the binding timestamp, not the observation timestamp. Sensor timestamps are server-generated ISO timestamps.

The mapper rejects missing/duplicate slots, mismatched joins/bindings (including conflicting stock statuses for the same product), invalid assignment nullability, duplicate product bindings, and malformed sensor values/timestamps. All three stock statuses may be unassigned or have one binding. Saved occupancy may disagree with stock status; this accepted demo mismatch does not invalidate the snapshot or disable assignment. An absent stock returns null only if it has no bindings. No versions are required or consumed.

Reads are advisory. Structural/join inconsistencies get one bounded retry, then Retry/staff guidance; no fabricated records or repairs. Stock/occupancy disagreements never silently release a reservation or change stock.

### Visible slot state and scan branch

| Saved occupancy + binding + stock | Display | Available to another product? |
|---|---|---|
| false/null + unassigned | Available (green); null also says Occupancy unknown | Yes |
| false + assigned EMPTY | Awaiting placement + product ID | No |
| false + assigned OCCUPIED/PENDING_DISPATCH | Off-rack / reserved + product ID | No |
| null + assigned | Occupancy unknown / reserved + product ID | No |
| true + assigned (any stock status) | Occupied + product ID | No |
| true + unassigned | Occupied / unidentified | No |

A scanned product bound to a slot with `isOccupied=true` shows **Already in Slot X · On rack (last saved occupancy)**, with no picker or location-action button; the parent screen retains Scan again. Otherwise it shows the eight-slot picker regardless of stock status. Its own slot is highlighted and labeled **Keep current slot (no change)**, disabled as a no-op. Expired expiry blocks assignment and normal dispatch; unknown expiry warns but allows assignment, reassignment, and dispatch. Dispatch requires a matching source with saved `isOccupied !== true`, regardless of EMPTY/OCCUPIED/PENDING_DISPATCH stock lag. Null occupancy is allowed for confirmed dispatch in this demo; staff must verify physical departure.

There is **no observation-age gate**, offline-rack blocker, or local freshness timer. Timestamps are retained for display/debugging only; a valid old, future, or null timestamp does not change eligibility. Treating unknown occupancy as selectable is a demo simplification, not proof of vacancy. A successful database read is required. The screen polls server-only snapshots about every **5 seconds** while foreground/mounted (skips overlapping actions), refreshes on foreground return, before showing confirmation, again after confirmation immediately before submission, and after success/error. No second barcode scan is needed to observe take-off or return. Background readings and open confirmations are invalidated.

Expiry uses the **phone's local calendar date**: valid through the expiry day; earlier dates expired; missing/invalid dates unknown. Assignment/reassignment and normal dispatch block only expired products. Unknown expiry remains unknown and shows a warning once per deliberate scan and in action confirmations. No phone date or expiry verdict is sent to the cloud. Sensor transitions must not depend on phone expiry: an expired physical return still restores OCCUPIED. This is a prototype policy, not trusted authorization.

## Commands and exact wire variables

Internal commands remain exactly `{ action, productID, sourceSlotID, targetSlotID }`, null for unused IDs. Product IDs are preserved verbatim, including leading zeros/spaces. Slot IDs are integers 1–8. Only applicable variables are sent:

| Mutation | Variables |
|---|---|
| `AssignProductToSlot` | `productID: String!`, `targetSlotID: Int!` |
| `ChangeAssignedSlot` | `productID: String!`, `sourceSlotID: Int!`, `targetSlotID: Int!` |
| `DispatchProduct` | `productID: String!`, `sourceSlotID: Int!` |
| `RecordExpiredScan` | `productID: String!`, `sourceSlotID: Int` (explicit null if unassigned) |

There are no PlaceProduct, MoveProduct, TakeOffRack, or ReturnProduct calls in the active workflow. No operation IDs, versions, ledger, sessions, client-selected statuses/activity types, or client timestamps are sent. No cancellation mutation is invented: canceling an alert makes no change; releasing an existing awaiting assignment needs a separately agreed operation.

### Required hosted transaction behavior (cloud owner)

Each command is one state/binding/vacancy-guarded transaction. Check existence, state, exact source binding, distinct target, unassigned target, uniqueness, slot range, not-known-occupied source/target and affected rows within the transaction. Do not require a recent occupancy timestamp; assignment/change use relaxed vacancy `is_occupied IS NOT TRUE`; dispatch requires `is_occupied = false`. Commit all required changes and activity together, or roll back. The app never chains independent stock/slot/activity writes.

| Mutation | Preconditions | Stock / activity | Assignment |
|---|---|---|---|
| Assign | No existing binding, unassigned target whose isOccupied is false/null; UI permits any valid stock status | Unchanged / none | Bind target and set assignedAt |
| Change assignment | EMPTY, PENDING_DISPATCH or OCCUPIED; matching source; source and unassigned target both false/null occupancy | Unchanged / none | Clear source productID **and** assignedAt; bind target with new assignedAt |
| Dispatch | Matching assignment, EMPTY/OCCUPIED/PENDING_DISPATCH stock, false/null source occupancy | EMPTY / DISPATCHED; derive warehouse delta from prior status (EMPTY: 0; others: −1) | Clear source productID **and** assignedAt |
| Expired scan | Existing product, source matches if present; phone expiry policy | Unchanged / REMOVED only | Unchanged |

Every phone command preserves `isOccupied` and `occupancyUpdatedAt`; only the rack reports physical facts. Other products can never claim a vacant reserved/awaiting slot. Selecting one's own awaiting/reserved/occupied slot is always a no-op. An occupied source cannot be reassigned. Assignment success says **Assignment saved. Put the product in Slot X**, not receipt or physical placement. The UI does not force a pending status to enable dispatch.

The separate rack command `ReportSlotOccupancy(slotID, occupied)` resolves identity from the assignment and owns EMPTY → OCCUPIED (first receipt, ON_RACK, warehouse +1), OCCUPIED → PENDING_DISPATCH (OFF_RACK, warehouse unchanged), and PENDING_DISPATCH → OCCUPIED (return, ON_RACK, warehouse unchanged). It must atomically store observation, stock transition and activity; repeated same-state reports must not duplicate events. Unassigned objects never fabricate a product receipt. Warehouse count remains OCCUPIED + PENDING_DISPATCH. These cloud/sensor operations are **not implemented or tested by this UI work**.

## Completion, uncertainty, and security

`LocationTransport` exposes `writesEnabled`, `readSnapshot(productID)`, and `executeCommand(command): Promise<void>`. Successful SDK completion is accepted as committed without a response envelope or ledger lookup. The adapter has bounded/cancellable reads, bounded submit, and rejects simultaneous submissions. Confirmations recheck eligibility and preserve the exact intended source/target: a changed binding requires a new deliberate confirmation instead of silently redirecting a dispatch.

The synchronous tap lock covers reads, alert, submission and final refresh; action/refresh buttons and Scan again are disabled while busy. Cancel/dismiss releases the lock. Failure/timeout refreshes and preserves an uncertainty warning across later refreshes. No mutation is automatically retried. Expired rejection is attempted once per mounted deliberate scan, including lost responses; another deliberate scan can record another REMOVED event. REMOVED is rejection, **not physical disposal or slot cleanup**.

Timeout stops waiting, not the hosted transaction. Without versions or a ledger there is **no exactly-once, restart recovery, or stale lifecycle/replay guarantee**. Saved occupancy may be stale or unknown and is not an atomic physical dispatch interlock: a return after the last sensor report or repeated removal-cycle race can still occur. Staff must check current inventory and the physical product before another deliberate action.

Prototype PUBLIC reads reveal assignments and PUBLIC mutations permit unauthenticated inventory changes. Transaction guards are not authorization. Keep isolated test data, obtain deployment/security approval, and review quotas/abuse/cost. No authentication expansion or embedded server secrets are part of this milestone. The cloud owner must review/deploy matching relaxed predicates and allowed stock states before phone acceptance; an older connector may still reject UI-eligible commands. Coordinated cloud deployment, emulator rollback/concurrency testing, sensor integration, and Android/iOS device acceptance remain separate requirements.

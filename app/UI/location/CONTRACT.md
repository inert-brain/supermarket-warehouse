# Direct Data Connect integration contract — single-phone MVP

The app uses the Firebase app and Data Connect `example` connector, `smart-warehouse-service`, `asia-southeast1`, configured in `receiving.ts`. No local command server is required. This document describes the simplified app contract; the Firebase owner must align and deploy the connector separately. Local UI tests do not verify deployed operations.

## Reads

Server-only `GetLocationSnapshot` takes `{ productID: string }` and returns:

```text
{
  stock: null | { productID, currentStatus, expiresOn, description },
  rackSlots: [{ slotId, productID, assignedAt,
                stock: null | { productID, currentStatus } }],
  productBindings: [{ slotId, productID, assignedAt }]
}
```

`rackSlots` must contain all eight slots 1–8, including empty slots. `productBindings` must include all bindings of the exact requested product, including out-of-range bindings. The mapper rejects missing/duplicate slots, mismatched joins/bindings, invalid assignment timestamps/nullability, duplicate product bindings, and incompatible stock states. An absent stock is null only if it has no bindings. Versions are not required or consumed.

Reads are advisory, not assumed transactionally consistent. An inconsistent read gets a bounded retry, then repair/refresh guidance. Expiry remains based on the **phone's local calendar date**: valid through the expiry day, earlier dates expired, missing/invalid dates unknown. This is a single-phone prototype trade-off, not trusted authorization. No phone date or expiry verdict is sent as a mutation variable.

## Commands and wire variables

Core commands are exactly `{ action, productID, sourceSlotID, targetSlotID }`, with null for unused IDs. Product IDs are preserved verbatim, including leading zeros/spaces. Slot IDs are integers 1–8. The adapter sends only applicable flat GraphQL variables:

| Mutation | Variables |
|---|---|
| `PlaceProduct` | `productID`, `targetSlotID` |
| `TakeOffRack` | `productID`, `sourceSlotID` |
| `ReturnProduct` | `productID`, `sourceSlotID` |
| `MoveProduct` | `productID`, `sourceSlotID`, `targetSlotID` |
| `DispatchProduct` | `productID`, `sourceSlotID` |
| `RecordExpiredScan` | `productID`, nullable `sourceSlotID` |

There are no operation IDs, version tokens, client-selected statuses, activity types, or timestamps. No LocationOperation read or write is needed by the app.

The Firebase owner supplies one **state/binding-guarded `@transaction`** per mutation. Product existence, permitted current state, exact source binding, target availability, slot range, uniqueness, and affected-row checks belong in the hosted transaction. Stock/slot changes and the fixed activity insert must commit together or all roll back. The client never chains independent stock/slot/activity writes.

| Mutation | Stock | Slot | Activity |
|---|---|---|---|
| Place | EMPTY → OCCUPIED | Bind target and assignedAt | ON_RACK |
| Take off | OCCUPIED → PENDING_DISPATCH | Retain binding/time | OFF_RACK |
| Return | PENDING_DISPATCH → OCCUPIED | Retain binding/time | ON_RACK |
| Move | OCCUPIED/PENDING_DISPATCH → OCCUPIED | Clear both source fields, bind distinct target | ON_RACK |
| Dispatch | PENDING_DISPATCH → EMPTY | Clear productID and assignedAt | DISPATCHED |
| Expired scan | Unchanged | Unchanged | REMOVED |

## Completion and uncertainty

`LocationTransport` has `writesEnabled`, `readSnapshot(productID)`, and `executeCommand(command): Promise<void>`. A successful SDK mutation completion is accepted as committed; no response envelope or ledger lookup is required. The adapter exposes only `writesEnabled`, bounded/cancellable `read`, and bounded `submit`. It rejects simultaneous submissions instead of queueing them.

The UI holds a synchronous tap lock through confirmation, mutation, and refresh. Slot/action/refresh buttons and Scan again are disabled while busy. Cancel/dismiss releases the lock. Success refreshes inventory; failure or timeout also refreshes, then asks staff to check current inventory and the physical product. An uncertain outcome is not shown as failure or success. Manual/foreground refresh retains that warning. No automatic mutation retry, pending-forever screen, UUID, AsyncStorage journal, or reconciliation API remains.

Timeout stops waiting; it cannot cancel the hosted transaction. Staff must check state before a new deliberate action. Without a ledger or versions, there is **no exactly-once, restart recovery, or stale lifecycle/replay guarantee**. In particular, a delayed expired-scan response cannot be verified from unchanged stock state. Expired rejection is attempted once per mounted deliberate scan and never automatically retried; a new deliberate scan may record another event.

Keep existing enums, warehouse counts, reserved off-rack assignments, scanner behavior, and staff-confirmed/not-sensor-verified labeling. PUBLIC mutations permit unauthenticated callers to change inventory; obtain deployment/security approval and use isolated test data. Firebase credentials, deployment, transaction/rollback tests, and device acceptance are separate from this UI-only change.

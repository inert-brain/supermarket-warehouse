# Superseded: immediate-placement/manual occupancy mutations

The previous six-mutation plan is **not an active design**. It was superseded
by `esp32/plan.md` (sensor occupancy + phone assignment/dispatch), then relaxed
for `app/UI/location/mvp-scan-plan.md` (no observation-age action gates).

Implemented contract: `LOCATION-CONTRACT.md`.
Additive schema/rollout handoff: `LOCATION-MIGRATION.md`.
Dashboard read shapes: `DASHBOARD-CONTRACT.md`.

Active mutations:

- `ReportSlotOccupancy(slotID, occupied)` resolves identity server-side and
  atomically persists observation, conditional product transition and activity.
- `AssignProductToSlot(productID, targetSlotID)` binds an unassigned EMPTY product
  to an unassigned false/null-occupancy target; no activity until physical placement.
- `ChangeAssignedSlot(productID, sourceSlotID, targetSlotID)` atomically moves a
  binding between not-known-occupied slots; EMPTY/OCCUPIED/PENDING_DISPATCH status,
  status time, activities and observations stay unchanged. Same-slot is a checked no-op.
- `DispatchProduct(productID, sourceSlotID)` requires false/null occupancy and
  PENDING_DISPATCH, clears binding/time, records DISPATCHED, retains observation.
  No assignment/change/dispatch operation gates on observation timestamps.
- `RecordExpiredScan(productID, sourceSlotID?)` logs REMOVED only.

`PlaceProduct`, `MoveProduct`, `TakeOffRack`, `ReturnProduct` no longer exist.
The former rule “EMPTY cannot be assigned” and moves that log immediate ON_RACK
are obsolete. No deployment or client changes are part of this subtree task.

# MVP Plan: Scan Product → Show On-Rack Status or Choose a Slot

## Goal

Make the school-demo flow usable without waiting for a recent ESP32 report. Keep phone → Firebase Data Connect and ESP32 → Firebase Data Connect. No new server, database migration, version fields, or operation ledger.

This plan intentionally accepts the last saved occupancy, even when old. ESP32 reporting continues when available; it is not a prerequisite for opening the slot picker.

## UI implementation status (2026-11-11)

The `app/UI/**` portion is implemented: saved occupancy (no age gate) controls the scan branch and slot eligibility; all valid stock statuses can show/use the picker when unassigned or bound false/null. Bound true shows Already in Slot X / On rack with no picker or location action. Dispatch still requires valid phone-local expiry, PENDING_DISPATCH and a matching source not known occupied. Structural snapshot checks, reservations, confirmation/preflight reads, double-tap locks and no automatic mutation retry remain.

No Firebase/cloud, ESP32 or dashboard files are changed by this implementation. The cloud requirements below are a separate owner's deployment/verification work, not completed by UI tests. Existing mutation names and variables are unchanged; an older connector can still reject the relaxed states. UI tests exercise core eligibility, nullable snapshot mapping, command wiring, screen callbacks, failures and uncertainty; they do not establish transactional rollback or physical-device behavior.

From `app/UI`, validate with `node --experimental-strip-types --test location-core.test.mjs location-adapter.test.mjs location-firebase-snapshot.test.mjs location-firebase-command.test.mjs location-workflow.test.mjs receiving-core.test.mjs`, `npm run typecheck`, and `npm run lint`. `npm test` runs the full UI test set. Expiry remains phone-local; no GPS, timezone, backend or new dependency is added.

## Assumptions for this MVP

- Remove the 30-second freshness requirement everywhere it gates assignment/reassignment/dispatch.
- An unassigned slot whose isOccupied is false **or null** can be selected. Only known occupied slots are blocked physically.
- Occupancy timestamps remain for display/debugging only, not permission to act.
- Known on-rack means the scanned product is assigned to a slot whose last saved isOccupied is true.
- Unknown occupancy does not prove vacancy; treating it as selectable is an explicit demo simplification.
- Keep existing phone-date expiry checks and stock/activity enums.

## Scan behavior

| Scanned product | Result |
|---|---|
| Unknown barcode | Show Product not found; no writes |
| Expired or missing expiry | Keep current rejection/verification behavior; no put-away action |
| Assigned and slot.isOccupied=true | Show Already in Slot X / On rack. No slot picker or location action |
| Assigned and slot.isOccupied=false | Show Off rack; show slot picker and existing departure action when eligible |
| Assigned and slot.isOccupied=null | Show Occupancy unknown; show slot picker without waiting for ESP32 |
| Unassigned, including Stock.currentStatus=EMPTY | Show slot picker immediately |

Do not require Stock.currentStatus=PENDING_DISPATCH merely to display the picker. Product status and a sensor report may not yet have caught up. The saved slot occupancy controls whether the scanned product is shown as definitely on-rack.

## Slot buttons

Retain eight buttons in 4 columns × 2 rows:

- Unassigned + false/null occupancy: green, selectable.
- Unassigned + true occupancy: gray, Occupied / unidentified, disabled.
- Assigned to another product: gray, show its product ID, disabled even when vacant.
- Assigned to the scanned product: highlight it. If physically true, the scan is the on-rack no-action case. If false/null, offer Keep current slot as a no-op or choose another green slot.
- No slot row or failed database read: show Retry. Do not invent missing database records.

No timestamp-age checks, offline-rack blocker, GPS, or timezone configuration. A successful database read is still required to know assignments.

## Saving assignment

### New/unassigned product

1. Scan and show available slots.
2. Select a green slot and confirm.
3. Call AssignProductToSlot.
4. Mutation checks target exists, has no other product, and isOccupied is not true. The UI permits unassigned products regardless of stock status; cloud stock-state guards must align separately.
5. Bind productID and set assignedAt; leave actual occupancy untouched.
6. Show Assignment saved. Put the product in Slot X.

Keep the existing receiving rule: assignment alone does not increase warehouse stock. A later sensor report of presence changes EMPTY → OCCUPIED and logs ON_RACK. The app remains usable without reports, but physical receipt confirmation cannot be inferred while the rack is disconnected.

### Already-assigned product off-rack or unknown

1. Allow another green target without requiring a fresh report.
2. Call ChangeAssignedSlot.
3. Cloud checks both affected slots exist; source still belongs to this product; neither source nor target has isOccupied=true; target is unassigned.
4. Atomically clear old productID AND assignedAt, then bind target and set its assignedAt.
5. Preserve the product's current stock status. Assignment is not a new receipt, return, or dispatch. Do not add ON_RACK solely because an assignment moved.
6. Allow the source product status to be EMPTY, PENDING_DISPATCH, or OCCUPIED for this relaxed assignment path, since unknown/outdated readings can disagree. Subsequent ESP32 reports reconcile status. This temporary mismatch is an accepted demo limitation, not a reason to disable the picker.

Never overwrite another product's reservation or delete product/history records.

## Departure

Keep explicit external-dispatch confirmation. No automatic dispatch from scanning or slot changes.

- Enable confirmed dispatch for a matching assignment with saved occupancy explicitly false, regardless of EMPTY/OCCUPIED/PENDING_DISPATCH stock lag; retain the valid-expiry check.
- No freshness checks. True blocks location actions; null remains picker-eligible but is not proof of being off rack and cannot authorize dispatch.
- Successful DispatchProduct atomically sets stock EMPTY, clears slot productID AND assignedAt, and logs DISPATCHED.
- Preserve the slot's saved occupancy fields; dispatch is not a sensor reading.
- Derive warehouse-count delta from the prior status: EMPTY has no count effect; OCCUPIED/PENDING_DISPATCH decrease by one. Do not force an intermediate pending status.

## Required implementation changes

1. **app/UI/location/core.ts:** remove observation-age gating from action selection. Accept EMPTY awaiting-placement bindings and relaxed assignment/status combinations without rejecting the entire snapshot. Keep unique assignment, valid IDs, and basic field checks.
2. **firebase-snapshot.ts:** retain nullable occupancy fields; do not classify old timestamps as unavailable.
3. **LocationWorkflow.tsx:** branch on the scanned product's bound slot. Known occupied → simple on-rack message and Scan again; false/null or unassigned → picker. Use clear Unknown wording without disabling all slots.
4. **firebase-command.ts / transport:** keep existing assignment and dispatch operation names; no backend URL. Do not automatically resend a timed-out mutation. Refresh and let staff inspect state.
5. **Firebase mutations:** remove occupancy_updated_at freshness predicates. Use is_occupied IS NOT TRUE for relaxed vacancy, while preserving source binding, target uniqueness, and transactional updates. Update reassignment's allowed stock-status check as described above. Keep known occupied slots protected.
6. **ESP32:** no change required. It continues reporting stable occupancy and cloud reconciliation updates product states/history.
7. **Dashboard:** keep manual Sync. Old/unknown occupancy may be displayed as old/unknown; do not describe it as live. If showing available slots under the demo rules, align the available-count calculation with unassigned + not-known-occupied and identify that as demo availability.
8. Update the app/Firebase contracts and README so the previous 30-second requirement is not still documented as mandatory.

No schema additions are required. Remove no existing product/slot/activity data.

## MVP tests

- WH-PROD-003 is EMPTY and unassigned; free slots have null occupancy → green choices appear immediately.
- Slot has false occupancy and an old timestamp → selectable if unassigned.
- Product assigned to slot 3 with true occupancy → Already in Slot 3; no location action or database write.
- Product assigned to slot 3 with false/null occupancy → picker appears even if Stock still says OCCUPIED.
- Reassign that product → old assignment/time cleared; new assignment/time saved; no artificial receipt or departure.
- Slot assigned to another off-rack product remains reserved and disabled.
- Occupied unassigned target remains disabled; an occupied source cannot be reassigned.
- Normal PENDING_DISPATCH departure still clears assignment and logs DISPATCHED once per successful state transition.
- Expired, unknown barcode, missing database slot, and network failure show clear messages.
- Double taps are blocked while submitting. Failed writes do not leave partial assignments/history.
- Run app tests, typecheck/lint, connector compilation, and a short Firebase emulator test. Deploy reviewed connector changes before phone testing.

## Known limitations accepted for the demo

Stale sensor values can show a physically present product as absent or vice versa. Unknown sensors are treated as usable for assigning unassigned slots. An assignment can work while the ESP32 is disconnected, but automatic physical stock/history reconciliation waits for it to report again. The single-phone MVP has no durable replay protection or complete race prevention. None of these require a new local backend.

## Done

A non-expired EMPTY product can immediately choose an unassigned slot without a fresh Hall report. A product last reported in its assigned slot shows On rack and no location action. A product off-rack can select another available slot, while existing explicit dispatch still works under its normal pending-status rule.

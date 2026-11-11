# Plan: Rack Reports Occupancy; Phone Assigns Products and Confirms Dispatch

## 1. Agreed scope

Single-rack school MVP, eight slots, one product ID per physical inventory unit.

- ESP32-S3 reads Hall sensors and reports **slot ID + occupied/vacant** only.
- The phone scans products to assign/change their slot and retains explicit external-dispatch confirmation.
- A product temporarily off-rack keeps its slot reserved. Its ID remains visible.
- Slot assignments can change only when the affected slots are physically vacant.
- Firebase automatically synchronizes product status and activity with sensor observations.
- No versions, operation ledger, custom backend, local server, GPS, or new quantity/box model. Expiry remains a simple phone-date check for receiving/assignment.

```text
Hall sensors → ESP32-S3 → Data Connect occupancy mutation → Slot + Stock + Activity
Phone scan ────────────→ Data Connect assignment mutation → Slot
Phone dispatch ────────→ Data Connect dispatch mutation ─→ Slot + Stock + Activity
Dashboard Sync ────────→ read-only cloud queries
```

This replaces the old design where the ESP32 looks up product IDs and directly chooses TakeOffRack or ReturnProduct. It also replaces app buttons that pretend to confirm physical placement or return.

## 2. Minimal schema change

Keep existing StockStatus, ActivityType, Stock, and Activity definitions. Add only physical-state fields to Slot:

```graphql
isOccupied: Boolean
occupancyUpdatedAt: Timestamp
```

These fields are nullable so existing/unreported slots are **Unknown**, not assumed empty. Use server request time for occupancyUpdatedAt. Do not add a redundant slot-status enum; derive the visible state from occupancy, assignment, and product status.

Keep Slot.productID, assignedAt, the unique product assignment constraint, and slot IDs 1–8. Existing assignedAt remains the binding timestamp, not the sensor-change time. Product IDs stay strings.

A previously valid assumption changes: an EMPTY product may now be assigned to a vacant slot **awaiting its first placement**. Update UI validation and dashboard warnings; this is not corrupt data.

## 3. Meaning of the two kinds of status

### Product status: Stock.currentStatus

| Value | Meaning |
|---|---|
| EMPTY | Not counted in the warehouse. May be unassigned, awaiting first placement, or already dispatched. |
| OCCUPIED | Assigned product is recorded as on the rack. Counts as one warehouse unit. |
| PENDING_DISPATCH | Product was removed from its assigned slot but has not been dispatched. Still counts as one warehouse unit. |

### Physical slot state: Slot.isOccupied

| Value | Meaning |
|---|---|
| true | Hall sensor reports stable presence. Identity comes from assignment, not the sensor. |
| false | Hall sensor reports stable vacancy. It may still be assigned/reserved. |
| null | No occupancy report yet; unavailable for assignment/dispatch. |

### Slot menu labels

| Sensor + assignment + product | Label | Can another product take this slot? |
|---|---|---|
| Vacant + no assignment | Available (green) | Yes |
| Vacant + assigned EMPTY | Awaiting placement | No |
| Occupied + assigned OCCUPIED | Occupied (gray), show product ID | No |
| Vacant + assigned PENDING_DISPATCH | Off-rack / reserved, show product ID | No |
| Occupied + no assignment | Occupied / unidentified | No |
| Unknown or stale observation | Unknown / awaiting rack update | No |

Unexpected combinations should refresh and show a warning rather than silently unbind or count stock. A temporarily inconsistent cross-table query is not a reason to fabricate a repair.

## 4. Receiving and first placement

1. Scan a known product. Use the phone's date for expiry: expired/unknown expiry blocks receiving assignment.
2. Read current slot observations and assignments from Firebase.
3. Select a physically vacant, unassigned slot. Unknown or occupied slots cannot be selected.
4. Confirm assignment. The cloud rechecks vacancy and lack of assignment, binds the product, and sets assignedAt.
5. **Keep Stock.currentStatus=EMPTY. No ON_RACK activity and no inventory increase yet.** The screen says Awaiting placement.
6. Staff physically place the product. The ESP32 reports stable occupied.
7. Firebase resolves the assigned product and atomically sets OCCUPIED, updates statusUpdatedAt, records ON_RACK, and saves the slot observation.

The first physical placement adds one warehouse unit. Repeated occupied reports do not add units or duplicate activities. Canceling an EMPTY awaiting-placement assignment is allowed only while the slot is vacant; clear its binding/time without pretending inventory departed.

Sensors cannot verify product identity. Staff must place the scanned product into its assigned slot.

## 5. Automatic sensor transitions

Create one predefined Data Connect mutation, provisionally named:

```text
ReportSlotOccupancy(slotID: Int!, occupied: Boolean!)
```

The ESP32 supplies no product ID, activity type, or next product status. Firebase resolves these from the stored assignment and current product status **inside the operation**.

| Observed state | Assigned product status | Cloud stock change | Activity | Binding |
|---|---|---|---|---|
| Occupied | EMPTY | OCCUPIED | ON_RACK | Keep |
| Vacant | OCCUPIED | PENDING_DISPATCH | OFF_RACK | Keep |
| Occupied | PENDING_DISPATCH | OCCUPIED | ON_RACK | Keep |
| Occupied | OCCUPIED | No change | None | Keep |
| Vacant | PENDING_DISPATCH | No change | None | Keep |
| Vacant | EMPTY | No change; awaiting placement | None | Keep |
| Either | No assigned product | No product change | None | None |

Persist isOccupied and occupancyUpdatedAt even when no product is assigned. Record no product activity for unidentified objects.

Use the **product state**, not merely whether the boolean changed, to decide transitions. Example: an object was observed occupied while unassigned, then assignment is later validly created after vacancy; the next placement must still reconcile the assigned product correctly. Periodic same-state reporting should recover missed connectivity, not duplicate history.

Each accepted product transition and its activity must commit with the slot observation in one transaction. Use conditional status and assignment predicates, check affected rows, and preserve uniqueness. Refresh/abort on changed assignment instead of changing the wrong product. Verify the actual Data Connect server-side expressions/conditional facilities with compiler and emulator; do not implement this as three independent client requests or add a laptop backend. Conditional/no-op paths must be tested as well as transitions.

The slot observation is the fact; the product status is its interpretation through the assignment. Sensor observations do not perform expiry rejection: an expired product physically returned still restores its recorded on-rack state. Receiving eligibility remains the phone's responsibility.

## 6. Temporary take-off and return

- Lift a product: stable vacancy automatically changes OCCUPIED → PENDING_DISPATCH and logs OFF_RACK.
- Keep Slot.productID and assignedAt populated. The slot remains unavailable to other products, and warehouse stock does not decrease.
- Put the same product back: stable presence automatically changes PENDING_DISPATCH → OCCUPIED and logs ON_RACK. Keep assignedAt unchanged and do not increase warehouse stock.
- The app no longer has normal manual Take off rack or Return buttons that can contradict the sensor. Return does not require another barcode scan.

## 7. Changing assignments: vacant only

A vacant slot is not necessarily available. Reserved slots cannot be given to a different product merely because the object is off-rack.

### Move the same assigned product to another slot

1. Lift it and wait until Firebase reports source vacant + PENDING_DISPATCH.
2. Scan it and select an unassigned, physically vacant target.
3. Cloud transaction verifies both source and target are vacant and assignment still matches.
4. Clear source productID AND assignedAt; assign target and set its assignedAt. Preserve both sensors' occupancy observations.
5. Keep product PENDING_DISPATCH. Selecting a new slot is not placement and must not log ON_RACK or change warehouse stock.
6. Physical placement in the new slot triggers OCCUPIED + ON_RACK through ReportSlotOccupancy.

An EMPTY awaiting-placement assignment can similarly be moved between vacant slots without adding inventory. Changing an occupied source or target is rejected. Another product cannot replace a pending product until that product is dispatched or moved to its own valid target. Never overwrite an assignment just to make a button selectable.

The app should clearly distinguish “assignment saved” from “product detected on rack.” Same-slot assignment is a no-op.

## 8. Dispatch keeps its current meaning

Staff still scan and explicitly confirm **Remove Product / external dispatch**.

Cloud checks:

- Matching product assignment.
- Product PENDING_DISPATCH.
- Source slot has a known, recent vacant observation.

Then atomically:

- Stock.currentStatus → EMPTY and statusUpdatedAt → request time.
- Clear Slot.productID **and** assignedAt.
- Insert DISPATCHED.
- **Keep Slot.isOccupied=false and its observation timestamp**; dispatch does not fabricate a sensor reading.

Warehouse stock decreases by one. The empty unassigned slot becomes available. Product/history records are not deleted.

A synchronized physical return changes the slot to occupied and the product to OCCUPIED, so dispatch is rejected. The simplified schema still cannot prevent every return occurring after the last cloud report or every repeated removal-cycle race. Do not claim an atomic physical dispatch interlock; keep the existing MVP's limitation explicit, without adding the previously rejected version/ledger machinery.

REMOVED remains expired-scan rejection: log it according to the current app policy, with no assignment/status/occupancy change. It is not physical disposal.

## 9. ESP32-S3 changes

Keep the single-file esp32.ino and editable settings at the top. Preserve GPIOs 4, 5, 6, 7, 15, 16, 17, 18, active-low configuration, 20 ms sampling, 300 ms debounce, Wi-Fi, TLS, and nonblocking sampling/network worker.

Replace product lookup + TakeOffRack/ReturnProduct selection with:

1. Establish each slot's first stable reading.
2. POST ReportSlotOccupancy with slot ID and boolean.
3. Send again on stable change; periodically report unchanged stable states as a simple heartbeat/reconciliation, for example every 5 seconds.
4. After reconnect, resend current stable states. Do not replay an offline backlog of old edges.
5. If a reading changes during a slow request, schedule the newest stable observation next. Never stop sensor sampling during HTTPS.
6. Parse HTTP/GraphQL errors and print the slot, reading, request outcome, and returned product interpretation. Do not print secrets.

The firmware no longer needs GetSlotMenu or knows the barcode to report presence. Repeated observation requests must not create repeated activities. Initial reporting reconciles existing cloud states: an already OCCUPIED occupied product stays unchanged, while an EMPTY assigned product detected present is its first receipt.

## 10. Observation freshness

Use occupancyUpdatedAt to avoid treating a disconnected rack's last state as current. Choose a simple documented threshold compatible with 5-second reporting, initially 30 seconds, and tune after testing all eight HTTPS reports. Show stale slots as Unknown and disable new assignment/dispatch until refreshed.

Use server timestamps for records; no GPS or extra timezone service. Where practical enforce freshness in the cloud command; the phone display alone is not authority. If an eight-slot reporting cycle routinely exceeds the threshold, increase the interval/threshold or add a small batch occupancy report rather than producing constant false offline alerts. Batch reporting is optional optimization, not required for first-slot integration.

## 11. App, dashboard, and connector updates

- Add occupancy fields to GetLocationSnapshot, GetSlotMenu, and dashboard slot queries; regenerate SDK output where used.
- Update snapshot validation to allow EMPTY + assigned vacant as Awaiting placement. Include occupancy/freshness in slot availability; null productID alone no longer means available.
- Replace PlaceProduct/MoveProduct's immediate stock transitions with assignment-only operations. Names such as AssignProductToSlot and ChangeAssignedSlot make their meaning clearer; migrate callers/deployed operations together.
- Disable/remove manual physical take-off and return commands from the normal phone workflow. Keep explicit dispatch and expired rejection.
- Refresh the phone while showing the slot screen, after foreground return, and before confirming actions. Do not require a second scan for sensor transitions.
- Dashboard remains manual Sync. Add sensor state and observation timestamp, show vacant/reserved separately from available, and retain warehouse count OCCUPIED + PENDING_DISPATCH.
- PUBLIC prototype operations remain publicly callable. Document this; no user authentication expansion in this milestone.

## 12. Migration and implementation order

1. Add nullable Slot.isOccupied and occupancyUpdatedAt; preserve all existing assignments, enums, records, and constraints. Do not initialize every slot to vacant.
2. Implement ReportSlotOccupancy and its transition/no-op paths first, with emulator tests. Implement assignment-only and vacancy-aware dispatch operations.
3. Update query contracts, UI validation/buttons, dashboard parsing, and their tests together.
4. Simplify esp32.ino to report only occupancy. Test one slot, then all eight, with current build/debounce tests preserved.
5. Review actual Firebase SQL diff, apply only the additive migration, and deploy the coordinated connector. No local schema edit alone updates Firebase.
6. Start firmware reporting to establish real observations, then test app assignments. Preserve existing OCCUPIED states on matched startup readings; investigate inconsistent fixtures explicitly.
7. Update README and scan-test guide with new meanings. Mark older immediate-placement plans superseded; do not leave two contradictory active write paths.

## 13. Acceptance tests

- Unreported slot: Unknown, never green.
- Vacant unassigned slot: available. Assign valid EMPTY product: awaiting placement, stock unchanged, no ON_RACK yet.
- Physical placement: isOccupied=true, OCCUPIED, exactly one ON_RACK.
- Lift: isOccupied=false, PENDING_DISPATCH, one OFF_RACK, same productID/assignedAt, warehouse total unchanged.
- Return without scanning: isOccupied=true, OCCUPIED, one ON_RACK, warehouse total unchanged.
- Duplicate stable reports: occupancy heartbeat may update; no additional stock transitions/activities.
- Occupied source/target: changing assignment rejected. Vacant reserved source: unavailable to another product.
- Change own pending assignment to vacant target: source clears, target binds, status remains pending until real placement.
- Dispatch while vacant/pending: EMPTY, binding/time cleared, one DISPATCHED, observation retained, warehouse −1.
- Dispatch after synchronized return: rejected, no partial writes.
- Occupied unassigned slot: unidentified, no product or receipt invented.
- Restart with occupied stored items: no duplicate receipts. Wi-Fi recovery reports latest state, not stale edge history.
- Any activity/assignment/status write failure rolls back the full transition.
- Expired scan: REMOVED log only; no automatic stock or slot cleanup.
- Phone and ESP32 work directly with deployed Firebase without a laptop service. Dashboard updates only when Sync is clicked.

This document is the plan only; no schema, firmware, app, dashboard, or cloud changes are applied by writing it.

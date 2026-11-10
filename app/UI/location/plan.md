# Plan: Synchronize Stock, Slot Assignments, and Activities

## 1. Scope and source of truth

Implement functional app-confirmed placement, temporary take-off, return, move, and external dispatch using the current Firebase Data Connect schema. One product ID is one product/inventory unit. Keep direct Expo → Data Connect access and the eight-slot menu. Rack + app double-check remains deferred; label this phase as staff-confirmed, not sensor-verified.

**Preserve the existing enums exactly:**

```graphql
enum StockStatus {
  EMPTY
  OCCUPIED
  PENDING_DISPATCH
}

enum ActivityType {
  ON_RACK
  OFF_RACK
  DISPATCHED
  REMOVED
}
```

StockStatus is a current snapshot. ActivityType is a historical event. They are related by transition rules, not by identical enum values. Do not replace StockStatus with ActivityType or introduce terminal stock statuses as the earlier version of this plan proposed.

## 2. State invariants

| Stock.currentStatus | Slot assignment | Meaning | Counts in warehouse? |
|---|---|---|---|
| EMPTY | No Slot references the product | Not currently stored; may be new/unreceived or previously dispatched | No |
| OCCUPIED | Exactly one Slot references the product | Product is on its assigned rack slot | Yes |
| PENDING_DISPATCH | Exactly one Slot references the product | Product is off-rack but still inside warehouse; assignment reserved | Yes |

- Retain the binding for an off-rack product so its slot button still displays its ID. The slot is not available to another product yet.
- Both slot.productID and assignedAt must be populated together, or both null.
- A product can have at most one slot; retain the existing unique relationship.
- An unassigned slot is green/selectable in this APP-confirmed phase; bound slots are gray and show productID plus On rack or Off rack—reserved. These labels are database states, not verified sensor readings.
- Missing/inconsistent records, such as EMPTY with a binding or OCCUPIED without a binding, fail closed. Show a repair message instead of silently changing data.
- Derive warehouse stock by counting OCCUPIED + PENDING_DISPATCH; rack stock by counting OCCUPIED. No extra counter is required.
- EMPTY does not distinguish never received from previously dispatched. History supplies that distinction. A deliberate new put-away of an eligible EMPTY product can receive it again; replaying an old command cannot.

## 3. Mandatory transition mapping

| Action | Stock before → after | Slot writes | Activity inserted | Warehouse effect |
|---|---|---|---|---|
| Place eligible product | EMPTY → OCCUPIED | Bind chosen unassigned slot; assignedAt=request.time | ON_RACK | +1 |
| Temporarily take off rack | OCCUPIED → PENDING_DISPATCH | Retain productID and assignedAt | OFF_RACK | No change |
| Return to same slot | PENDING_DISPATCH → OCCUPIED | Retain productID and original assignedAt | ON_RACK | No change |
| Move to another slot | OCCUPIED or PENDING_DISPATCH → OCCUPIED | Clear old slot productID AND assignedAt; bind new slot/time | ON_RACK | No change |
| Confirm external dispatch | PENDING_DISPATCH → EMPTY | Clear source productID AND assignedAt | DISPATCHED | −1 |
| Reject expired scan | Any status → unchanged | No assignment changes | REMOVED | No change |
| Repeated same-state action/command | Unchanged | No changes | No duplicate event | No change |

### Important REMOVED exception

Your ActivityType documentation defines REMOVED as **expired scan rejection**, not a confirmed disposal. Therefore a REMOVED event is intentionally not a stock transition. It must not force currentStatus=EMPTY or clear a stored product's slot. For an expired incoming EMPTY record, it stays EMPTY/unassigned. For an expired stored product, retain its current state and binding; show rejection and staff guidance.

Do not add a disposal/write-off mutation under this label without a separate agreed rule. If you want REMOVED to mean actual inventory removal instead, change that requirement and its enum description deliberately first.

### Slot cleanup example

Before dispatch: Stock WH-PROD-006 is PENDING_DISPATCH; Slot 3 references WH-PROD-006 with assignedAt populated.

After one successful dispatch transaction: Stock becomes EMPTY; Slot 3.productID=null AND Slot 3.assignedAt=null; one DISPATCHED activity references WH-PROD-006. The product record and old activities are preserved. Slot 3 becomes available and its button stops displaying that product.

## 4. Functions and database responsibilities

### Read functions

- `getProductContext(productID)`: exact-key product lookup plus current slot binding, status, expiry, and concurrency token. Preserve string barcode values. Do not equate EMPTY with unknown product; absent record means not found.
- `getSlotMenu()`: read slots 1–8 with their joined Stock.currentStatus. Derive unassigned/on-rack/off-rack-reserved from validated data. Never map successful binding data universally to Unknown as the current loader does.

### Command functions

Each command takes a unique operationID, productID, relevant slot IDs, and observed state/version tokens. It calls one guarded trusted operation, not multiple client writes.

1. `placeProduct`: verify known valid expiry, EMPTY, no existing binding, target unassigned. Bind target, set OCCUPIED and statusUpdatedAt, insert ON_RACK, save operation outcome together.
2. `takeOffRack`: verify OCCUPIED and matching source binding. Set PENDING_DISPATCH and statusUpdatedAt, retain binding/time, insert OFF_RACK, save outcome together.
3. `returnProduct`: verify PENDING_DISPATCH, matching reserved slot, known valid expiry. Set OCCUPIED and statusUpdatedAt, preserve binding/time, insert ON_RACK, save outcome together.
4. `moveProduct`: verify OCCUPIED/PENDING_DISPATCH, known valid expiry, matching source, distinct unassigned target. Release source then bind target inside the same transaction to respect the unique product binding. Set OCCUPIED and statusUpdatedAt; insert one ON_RACK event and save outcome. Do not count this as another receipt.
5. `dispatchProduct`: verify PENDING_DISPATCH, matching source and current action token, known valid expiry, explicit staff confirmation. Clear BOTH source assignment fields, set EMPTY and statusUpdatedAt, insert DISPATCHED, save outcome together. Scanning alone never dispatches.
6. `recordExpiredScan`: verify the product is expired using trusted store date. Insert REMOVED and save scan-operation outcome only. Stock.currentStatus, statusUpdatedAt, and all slot fields stay unchanged. Repeated callbacks/retries for one scan reuse the operationID; a new deliberate scan may create another rejection.

Same-slot OCCUPIED selection is a no-op. Same-slot PENDING_DISPATCH selection is returnProduct. Unknown products or missing/invalid expiry cannot be received, moved, returned, or dispatched. Temporary take-off need not depend on expiry because it does not change warehouse inventory. Expired normal dispatch is blocked; disposal is deferred, not silently simulated.

## 5. Atomicity, concurrency, and minimal supporting changes

The supplied schema can express the state/event mapping but does not identify an individual pending removal or persist retry identities. Do not claim strict stale-confirmation and replay safety using these three tables alone.

- Keep existing enums/tables/column mappings. Propose additive Stock.version and Slot.version fields, initialized safely to 0, plus an Operation table keyed by client-generated UUID storing command payload/fingerprint and committed result. These are supporting safety fields, not new product/location models. Review any schema additions before applying them.
- Increment product version on each state transition. Increment affected slot versions when taking off/returning/moving/assigning/releasing, even when the retained binding is unchanged. This invalidates confirmation captured before a return and second removal.
- Execute state, slot, event, version, and operation-result writes in a single transaction. If activity insertion or any check fails, roll back everything. Set activity occurredAt and changed stock statusUpdatedAt from the same trusted request time. A move can log an event/update time even if status remains OCCUPIED; a true no-op does neither.
- Use conditional writes against expected versions, validating affected row counts. A prior read followed by unconditional updates is not sufficient for two phones competing for a slot. Keep database uniqueness as an additional guard.
- Same operationID + same payload returns its prior committed result without duplicate history. Same ID + different payload fails. After a timeout, reconcile/retry that same ID; do not generate a new action ID automatically.
- Implement narrowly defined Data Connect mutations using @transaction, @check, parameterized fields, and supported conditional write/replay facilities. Verify exact syntax/guarantees against current SDK/docs and emulator. If these guarantees cannot be expressed, use a narrow trusted server command endpoint rather than weakening the checks. Preserve direct Firebase reads.
- Optional audit enhancements: Activity operationID and source/target slot snapshots. Current Activity fields alone cannot reconstruct past slot moves after bindings change. Document these as proposed additions, not present fields.
- Enforce slot IDs 1–8 and assignment/time consistency in trusted operations or DB constraints. Do not delete rows or cascade-delete history as a location operation.

## 6. Expiry and access policy

- Preserve valid-through-expiry-day behavior in the confirmed store timezone. Trusted mutation time/date is authoritative; phone check is advisory only.
- Separate product lookup from receiving eligibility so expired, PENDING_DISPATCH, and EMPTY records can still display their status and appropriate guidance.
- No end-user authentication is requested, but public mutations can be invoked by anyone. Transactions ensure consistency, not authorization. Explicitly review/approve the exposure for a disposable isolated prototype or use restricted server access. Never expose arbitrary CRUD or embed server credentials in Expo.
- Keep REMOVED rejection logging idempotent; do not let client-supplied activity types bypass the transition rules.

## 7. App actions

- EMPTY + valid expiry: show the 4×2 menu; green unassigned slots select placement. Confirm product and target before writing.
- OCCUPIED: show current assignment, allow Take off rack or move to another green slot. Same-slot press is no-op. Remove Product is disabled until take-off.
- PENDING_DISPATCH: retain product ID on reserved slot; enable same-slot return, another-slot move, or full-width Remove Product for confirmed external dispatch.
- Expired: reject put-away/return/move/dispatch, record REMOVED once for that scan, retain existing inventory state/binding. No fake disposal.
- Unknown expiry: block eligibility-sensitive writes and show verification guidance. Unknown product: show not found, no writes.
- On command success/conflict refresh product and all slots. Disable repeat submissions while pending, preserve operation IDs across retries, discard stale lookup results, and never display success before commit. Recover after app restart/network uncertainty by reconciling the pending operation, not resubmitting with a fresh ID.

## 8. Implementation and validation checklist

1. Read current UI/AGENTS.md and installed Expo/Firebase docs. Reuse existing dependencies and single-screen layout. Run npm ci; add no unnecessary UI/database framework. If secure UUID generation is unavailable, use npx expo install expo-crypto.
2. Implement pure state/action mapping tests before writes. Propose and review only the supporting safety schema additions; do not change the user's enums.
3. Inspect/backfill existing fixture inconsistencies with manual approval; do not silently classify PENDING_DISPATCH without a binding as valid. Preserve history.
4. Add/test exact command operations, stock/slot queries, and typed client adapters. Deploy connector updates explicitly to smart-warehouse-3171e only after migration/security review; local files alone do not publish operations.
5. Update the slot loader and UI so app-only assignments are usable. Keep sensor status separate and clearly deferred; no universal Unknown blocker after successful valid reads.
6. Test every row of the transition table against Stock, Slot, Activity, and Operation. Include activity-write failure rollback, duplicate taps, lost responses, a return followed by another take-off, two clients claiming one slot, simultaneous move/dispatch, and expired rejection without inventory loss.
7. Verify derived warehouse count: placement +1; temporary take-off/return/move 0; dispatch −1; expired rejection 0. A later deliberate receipt of an eligible EMPTY product is a new lifecycle, not a replay.
8. Verify product IDs remain visible OFF_RACK/PENDING_DISPATCH and disappear only when binding is actually released. Confirm moves clear old timestamps, same-slot returns preserve them, and a failed command changes nothing.
9. Run tests, typecheck, lint, Android bundle export, then live test connector and Android camera. Update README and temporary test guide with implemented—not promised—behavior. No deployment/seed/migration is performed by this plan.

## 9. Later rack integration

Replace APP-only placement/take-off confirmation with stable rack occupancy events and explicit receiving/removal sessions. Sensor removal maps to PENDING_DISPATCH + OFF_RACK, keeping binding; app dispatch validates the same active removal then maps to EMPTY + DISPATCHED and clears binding. Sensor return maps to OCCUPIED + ON_RACK and invalidates old confirmation. Restart loads existing states; repeated readings do not create additional stock or events. Do not mislabel prior APP-only history as sensor verified.

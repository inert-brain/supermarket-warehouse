# Plan: Scan → Select Slot or Remove Product

> Historical plan, superseded by [location/CONTRACT.md](location/CONTRACT.md) and [location/mvp-scan-plan.md](location/mvp-scan-plan.md). Current UI uses saved occupancy without age gating: bound true shows Already in Slot X with no picker/action; false/null or unassigned shows the picker regardless of stock status. Do not implement session/version/ledger machinery, timezone configuration, or immediate app-driven stock transitions below. Current commands save assignments only; rack sensors control placement/take-off/return. Expiry uses the phone's local date. Cloud/hardware/dashboard work is owned separately.

## Goal

Extend the existing Expo scanner: after a known, non-expired barcode is scanned, show eight slot buttons in **4 columns × 2 rows**, followed by one full-width **Remove Product** button spanning all four columns. Reuse the direct Firebase Data Connect integration; do not restart the local backend or add SQLite synchronization.

## Instructions for GPT Terra

- Read `AGENTS.md`, `App.tsx`, `receiving.ts`, `receiving-core.ts`, and the Firebase schema/connector before editing. Verify APIs against the installed Expo SDK's documentation.
- Preserve existing permission handling, Code 128 scanning, barcode strings, expiry tests, retry handling, and stale-request protection. Do not rename existing SQL columns or remove relationships to simplify the UI.
- Implement small modules for slot reads/actions and a reusable slot-picker component. This can remain a single-screen state flow; no navigation framework is needed just for conditional rendering.
- Do not deploy, seed, or apply destructive migrations without reviewing the changes. Do not delete `app/backend` or modify the local SQLite database.

## Installation and dependencies

From `app/UI`:

```sh
npm ci
npm run typecheck
npm test
npm run lint
```

React Native, TypeScript, Expo, `expo-camera`, and the Firebase JS SDK are already installed. Use built-in `View`, `Pressable`, `Text`, and layout styles; no grid, UI, or navigation dependency is required. If a genuinely necessary Expo module is missing, use `npx expo install <package>` after checking compatibility.

Keep the existing Firebase variables and confirmed store timezone in `.env.local`; no backend URL or server credentials belong in the app. Use the existing Firebase CLI for connector/schema work. New Data Connect operations require deployment before device testing, targeting `smart-warehouse-3171e` explicitly.

## Product decisions to confirm before implementing writes

1. **Remove Product meaning:** proposed meaning is confirming the scanned box's active removal from the rack, not deleting its product record. Confirm whether this is a shelf transfer (store total unchanged) or external dispatch (warehouse inventory decreases). Never guess this stock effect. The button's dimensions do not determine its meaning.
2. **Existing box reassignment:** a known barcode is eligible for put-away just like a newly received box, but this does not necessarily represent a new receipt. An already stored box must not be assigned to a second slot. Confirm how a box moving between slots is identified and how a completed removal is reversed without double-counting. Block unsupported transfers rather than clearing an old assignment automatically.
3. **Sensor readiness:** confirm where embedded occupancy is published and how placement/removal sessions are identified. If unavailable, deliver the UI and clearly labeled assignment-only prototype first; do not claim physical receipt/removal or fabricate sensor confirmation.

## Screen behavior

1. Scan once and lock the scanner during lookup and action selection.
2. Reuse product lookup and the current expiry rule: valid through the stated store-calendar date. Unknown barcode, lookup failure, or missing/invalid expiry must not enable put-away. Expired products show rejection and cannot be placed through this receiving flow.
3. For an eligible product, load fresh slot data and show its barcode, description, expiry, and the action panel:

```text
[ Slot 1 ] [ Slot 2 ] [ Slot 3 ] [ Slot 4 ]
[ Slot 5 ] [ Slot 6 ] [ Slot 7 ] [ Slot 8 ]
[                Remove Product               ]
```

4. **Green:** empty and available, selectable. **Gray:** occupied, disabled. Also show text labels, not color alone. A vacant but reserved/removal-pending slot is disabled and labeled accordingly, not shown as available. Loading, missing slot rows, stale/failed reads, and unknown sensor states must not appear green. Explain when no slot is available.
5. Tapping an available slot shows confirmation with the product and slot number. Disable all action buttons while submitting; show pending placement or a precise error afterward. Include **Scan again** to exit the flow safely.
6. Keep **Remove Product** full-width beneath the grid. Enable it only when the scanned product has a matching active removal; otherwise explain that no pending removal exists. Show an explicit confirmation dialog before submitting.
7. Placement gating must not permanently prevent disposal of expired boxes. Disposal is a separate future action; do not label an expired box eligible for shelf transfer to work around receiving rejection.

## Data and transition logic

The current `Slot` model has only `slotId`, `productID`, and `assignedAt`. These describe **binding**, not physical occupancy or a pending action. `Stock.currentStatus` alone cannot describe unidentified objects or distinguish repeated removal attempts.

- Extend the model deliberately with sensor occupancy and a workflow/session identity (or equivalent existing embedded records). Separate available, awaiting placement, stored, removal pending, and unidentified states. Keep the existing unique product-to-slot constraint. Review migration and existing rows before deployment.
- Seed slot IDs 1–8 only if missing, using reviewed idempotent fixtures. Do not replace existing assignments. Enforce the 1–8 range and valid state combinations in trusted operations or database constraints.
- Add a limited slot-status query. Retain the existing exact-key product query and string IDs. Refresh slots when opening the panel, after actions, and on return to the foreground; never trust a previously green button as a write precondition.
- Add guarded, transactional operations for reservation/cancellation and removal confirmation. Recheck current assignment, slot availability, product eligibility, and action identity in the trusted operation. State changes and their history events must commit together. A read followed by an unconditional client update is not sufficient.
- No user authentication is requested in this phase. Explicitly review the exposure of each new operation: public reads disclose assignments and public writes allow anyone to invoke them. Transactions protect consistency, not authorization. Do not silently add broad public CRUD access. If appropriate restrictions are not agreed, keep writes mocked/disabled instead of deploying publicly.

### Put-away

Select slot → confirm → transaction reserves that exact slot and binds the scanned product as awaiting placement → staff place the box → stable sensor placement completes storage and logs the event. Only a genuinely new receipt increases warehouse inventory; a return or internal move must not create another receipt. Selecting a button never sets physical occupancy. Duplicate taps/retries must not repeat the transition. Cancel before placement safely releases the reservation.

### Remove Product

Sensor reports stable vacancy → pending removal retains its product binding and has a unique identity → staff scan, press Remove Product, and confirm → transaction validates that same removal and applies the agreed shelf-transfer/dispatch effect → release binding and log completion. No match means no changes. A return invalidates the old confirmation; retries cannot deduct stock twice. Merely scanning or tapping must not set physical occupancy to vacant or delete the `Stock` record.

## Verification and completion criteria

- Unit tests: all expiry cases; slot color/enabled mapping; null assignment versus actual availability; already-bound products; removal eligibility.
- Operation tests: two clients competing for one slot; the same product assigned twice; duplicate submissions; stale removal after return and re-removal; canceled placement; no receipt from a repeated sensor reading; no double-count when moving an existing box.
- Android check: scan an eligible fixture; verify exactly eight buttons in 4×2 layout and a four-column-wide Remove Product button. Confirm occupied slots cannot be selected, unavailable data fails closed, and retry/scan-again cannot display an old product's result. Verify unknown/expired fixtures remain blocked for put-away.
- Run typecheck, tests, lint, and an Android bundle export. Verify deployed connector behavior and sensor transitions separately; do not report a full physical workflow tested using only mocks.
- Update `README.md` with setup, any new schema fields/operations, deployment commands, and clear limits if sensor actions are simulated. Keep quantities, sales, partial returns, timeout defaults, and dashboard sync outside this UI milestone.

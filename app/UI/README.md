# Receiving scanner

The Expo app reads receiving details directly with the Firebase JavaScript Data Connect SDK. Location uses direct Data Connect occupancy/assignment snapshots and four fixed mutations, with writes enabled. Assignment is not physical receipt; rack sensors control placement, take-off, and return. See `location/CONTRACT.md` for the simplified single-phone connector interface and uncertainty limitations. It uses `queryRef` and `executeQuery` with the deployed `GetStockByProductID` operation (the same API used by the generated SDK); the operation name, variables, response shape, connector, service and region in `receiving.ts` must match `firebase/dataconnect/example/queries.gql` and the deployed connector. See the [Firebase web SDK guide](https://firebase.google.com/docs/data-connect/web-sdk). No generated SDK installation is required by this app.

The identifier field/parameter is now `containerID`; operation names such as
`GetStockByProductID` remain unchanged. Deploy the matching Data Connect contract
and update the app, dashboard, and ESP32 together. SQL columns and stored barcodes
are unchanged; older clients still expect the previous field name.

## Security and deployment

`GetStockByProductID` is deliberately **PUBLIC** and unauthenticated. Anyone who knows or guesses a container ID can repeatedly query its ID, description and expiry, regardless of whether they use this app. That query uses one exact primary key and returns only those fields. Other connector operations include PUBLIC inventory mutations. Firebase client configuration and API keys are not secrets or authorization. Review the exposure, quotas and potential abuse/cost with the project owner before deploying; if this data is sensitive, use authenticated authorization and appropriate access controls instead. Do not put service-account keys, Admin credentials or other secrets in the app or Expo environment variables.

The connector also defines the public `GetSlotBindings` query, which exposes slot IDs and their product assignments. Review that additional disclosure before deployment. Both queries must be deployed before the app can use them. **Deployment is not automatic.** From `firebase/`, after selecting and verifying the intended Firebase project and reviewing all connector changes, use the Firebase CLI:

```sh
firebase deploy --only dataconnect
```

This may deploy other Data Connect changes in that project too; review the deployment plan and existing operations first. Ensure the Data Connect service, database, schema and seeded stock are configured in the target project. The repository identifies service `smart-warehouse-service`, region `asia-southeast1`, connector `example`; update `receiving.ts` if your deployment differs. Changes to a query require coordinated deployment and app updates. Do not deploy production until public access is explicitly approved.

## App setup

Use Node.js 22.13 or newer and register a Firebase **web app** in the target Firebase project. Copy its public configuration into `app/UI/.env.local` (not service account credentials):

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=your-web-api-key
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-web-app-id


```

No store timezone configuration is required for this single-phone prototype. Expo embeds `EXPO_PUBLIC_` values in the client; configure them for builds as well and fully reload after changes. From `app/UI`:

```sh
npm ci
npm run typecheck
npm test
npm run lint
npx expo start
```

The scanner enables Code 128, EAN-13, EAN-8, UPC-A, UPC-E and Code 39 using the [Expo SDK 58 Camera barcode types](https://docs.expo.dev/versions/v58.0.0/sdk/camera/#barcodetype). It sends the camera's returned string verbatim as `containerID`, including spaces and leading zeros; there is no trimming, numeric conversion, UPC/EAN normalization or separate barcode mapping. Native barcode decoding/representation can differ across platforms; verify actual Android/iOS retail labels against the intended container IDs.

### Missing-product registration

The UI requires the separately supplied connector mutation `RegisterScannedProduct($containerID: String!)`, returning `{ registration: 0 | 1 }`. Its contract is **insert on conflict do nothing**, with a new stock row using the exact ID, `description: null`, `expiresOn: null`, and `status: EMPTY`. Count 1 means this request created the row; count 0 means another row already exists and must remain untouched. These defaults and conflict safety belong to the server operation, not client-written fields. This UI-only change neither modifies nor deploys the connector; the Firebase owner must supply the matching operation and review its authorization/abuse exposure before use.

1. Execute `GetStockByProductID` with `SERVER_ONLY`.
2. Only an explicit `{ stock: null }` allows registration. A failed lookup, missing `stock` field, malformed row or mismatched container ID never triggers a mutation.
3. Call `RegisterScannedProduct` once, passing only the unchanged `containerID`; require a numeric count of 0 or 1.
4. Reread `GetStockByProductID` with `SERVER_ONLY` and validate/interpret that row. Never fabricate a local product from the mutation count. Existing products take only the initial read.
5. Mount `LocationWorkflow` only after the receiving flow succeeds, avoiding a concurrent location read of a not-yet-created record. Show “New product registered” only for count 1 followed by a successful reread.

New records have **unknown expiry**, not an invented future date. Registration is not receipt or permission to put away: existing unknown-expiry policy still blocks assignment and normal dispatch until staff verify expiry through the owner's data-maintenance process. This change adds no expiry editor or automatic date write.

Connectivity is required. Failed/malformed registration or rereads do not yield success or mount location. Scan again, unmount or the 15-second flow timeout stops waiting. Cancellation before mutation submission prevents a later registration, including when a missing-product lookup returns late. Data Connect requests already submitted cannot be cancelled: a mutation may finish after cancellation/timeout, and the UI does not roll it back or automatically resend it. Retry starts with a fresh server lookup; if the row now exists, it is not registered again. After an uncertain outcome, creation attribution may be lost on retry, so no creation message is claimed.

## Location operations

The grid and commands use Data Connect directly; there is no command service URL or HTTP fallback. See `location/CONTRACT.md` for the exact mutation variables and snapshot shape. The Firebase owner must separately deploy nullable `Slot.isOccupied` / `occupancyUpdatedAt`, include them and joined stock status in `GetLocationSnapshot`, and deploy the matching vacancy-aware transactions. This UI-only change does not deploy or modify Firebase, hardware, or dashboard code. Missing query fields fail closed; explicit null occupancy remains Unknown but is selectable on unassigned slots under the demo rules. The cloud owner must separately align/deploy relaxed not-known-occupied predicates and stock-state checks before phone acceptance; an older deployed connector may still reject UI-eligible commands.

The four operations are `AssignProductToSlot(containerID, targetSlotID)`, `ChangeAssignedSlot(containerID, sourceSlotID, targetSlotID)`, `DispatchProduct(containerID, sourceSlotID)`, and `RecordExpiredScan(containerID, sourceSlotID nullable)`. Commands contain only action, containerID, sourceSlotID, and targetSlotID. There are no versions, operation IDs, operation-ledger lookups, or durable command journals. Confirmation, submission, and refresh disable repeat taps and Scan again. Every mutation outcome refreshes inventory. On error or timeout, the app asks staff to check inventory and the physical product rather than automatically retrying. A timed-out transaction may still complete; there is no exactly-once/restart/replay guarantee. Refresh remains available after the bounded wait, without an indefinitely pending operation. Expired-scan rejection is attempted once per deliberate scan and is not automatically retried on uncertainty. Local tests do not establish deployed cloud behavior or physical-device acceptance.

### Occupancy vs assignment

- An unassigned slot with `isOccupied` false or null is Available/green, even with an old or missing timestamp. Null is explicitly labeled Occupancy unknown, not proven vacant. Known occupied/unidentified slots and every other product's reservation remain disabled.
- Assigning an EMPTY product saves a binding only: **Awaiting placement**, stock unchanged, no ON_RACK event. Staff must put the scanned product in that slot; sensors cannot verify identity.
- A scanned product bound to a slot with saved occupancy true shows **Already in Slot X / On rack**, with no picker or location action. False/null occupancy or no binding shows the eight-slot picker regardless of stock status, including mismatched OCCUPIED. Reassignment requires source and target not known occupied and an unassigned target; stock/history/count stay unchanged. The highlighted own slot is **Keep current slot (no change)**.
- There are no manual take-off/return buttons. The rack reports placement/removal/return, retaining off-rack reservations. Warehouse stock remains OCCUPIED + PENDING_DISPATCH. Explicit confirmed external dispatch requires a bound source with saved occupancy explicitly false, regardless of EMPTY/OCCUPIED/PENDING_DISPATCH stock lag. Null is not proof of being off rack. Dispatch sets EMPTY, releases both assignment fields, logs DISPATCHED, and never fabricates a sensor observation. Derive the warehouse-count delta from the prior status: EMPTY has no count effect; OCCUPIED/PENDING_DISPATCH decrease by one.
- No age/freshness checks or offline-rack blocker authorize actions. Timestamps are retained for display/debugging only. The mounted screen polls about every 5 seconds while foreground, refreshes on foreground return, before confirmation and again before submission, and after outcomes. Polls do not overlap an action. A changed binding requires a new confirmation; missing slot rows or failed reads show Retry without invented records.
- Expired/unknown expiry blocks assignment and normal dispatch; an expired scan logs REMOVED once without changing stock/assignment/occupancy. Physical returns remain sensor-controlled regardless of expiry. No disposal or awaiting-assignment cancellation operation is invented.
- Saved occupancy may be old or unknown and is not a physical dispatch interlock. Treating unknown as selectable is an explicit demo simplification. The simplified MVP retains races after the last sensor report and offers no lifecycle/replay guarantees.

### Isolated scan / sensor acceptance guide

1. Scan valid unassigned WH-PROD-003 (EMPTY). Unreported unassigned slots must be green/selectable and explicitly say Occupancy unknown. Old false readings must also remain selectable.
2. Assign a selectable target; verify Assignment saved / Put the product in Slot X, EMPTY stock, no ON_RACK and no inventory increase. Tap its highlighted own slot: no action. Another product must not claim it.
3. Bind a product to Slot 3 with saved occupancy true: verify Already in Slot 3 / On rack, no picker/action, and Scan again available, regardless of stock status or observation age. Physical placement/lift/return should still reconcile stock through sensors, not app writes.
4. Set that source false/null with OCCUPIED stock: verify picker immediately. Reassign to an unassigned false/null target. Verify source binding/time clear, target binds, stock/history/count unchanged. Known true source/target and other products' reservations must block this.
5. Dispatch while PENDING_DISPATCH with false/null source occupancy: verify explicit confirmation, EMPTY, DISPATCHED once, warehouse −1, cleared containerID/assignedAt, unchanged sensor observation. Return before confirming: known true occupancy must block the command. Other stock statuses must not gain a forced-dispatch path.
6. Stop rack reporting: saved values remain usable without an age cutoff. Background/foreground the phone: it must fetch again. Confirm missing slots/network failures offer Retry, do not fabricate state, automatically retry mutations, or duplicate expired rejection logs. Double taps must send only one command.
7. Scan expired/unknown-expiry fixtures using the phone's local date. Verify assignment blocked; expired rejection changes only activity. Confirm expired physical return still reconciles via the sensor.

These are deployed-cloud/device checks for the owners, not claims made by local UI tests. Verify transaction rollback and concurrent command guards in cloud emulator tests separately.

## Decision limitations and verification

The app calculates expiry using the **phone's local calendar date**. A valid expiry date is eligible through that date, earlier dates are expired, and missing/invalid dates are unknown. Device clock errors or tampering, client modifications and stale data can produce an incorrect decision: this is an MVP trade-off, not trusted server-side authorization. Staff must verify eligibility before put-away.

Automated tests cover response validation, local date boundaries, injected lookup/register/reread ordering, conflict counts, exact barcode identity, failure/cancellation paths, and App render gating/creation messages. They do not contact Firebase or exercise the native camera. Before operational use, deploy to an isolated test project and test the actual Android/iOS Expo runtime, camera, network failures, timeout/retry and known/missing products. Check yesterday/today/tomorrow and missing expiry fixtures using the phone's local date, verify the public operation's access and returned fields, and verify the expected stock, slot and activity changes through the isolated service. Native runtime and deployed schema/data are not verified by these local tests.

## Container product scan

After a container scan, an empty description prompts a product barcode scan. The app checks `shopping-cart/{productCode}` in Firestore, then saves the exact product ID as the container stock description. Existing descriptions can be changed using **Change product**. Deploy `SaveContainerProduct` to Data Connect before using this flow. Product validation is client-side and requires Firestore read access.

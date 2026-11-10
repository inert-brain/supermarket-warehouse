# Receiving scanner

The Expo app reads receiving details directly with the Firebase JavaScript Data Connect SDK. Location uses direct Data Connect snapshots and six fixed mutations, with writes enabled. See `location/CONTRACT.md` for the simplified single-phone connector interface and uncertainty limitations. It uses `queryRef` and `executeQuery` with the deployed `GetStockByProductID` operation (the same API used by the generated SDK); the operation name, variables, response shape, connector, service and region in `receiving.ts` must match `firebase/dataconnect/example/queries.gql` and the deployed connector. See the [Firebase web SDK guide](https://firebase.google.com/docs/data-connect/web-sdk). No generated SDK installation is required by this app.

## Security and deployment

`GetStockByProductID` is deliberately **PUBLIC** and unauthenticated. Anyone who knows or guesses a product ID can repeatedly query its ID, description and expiry, regardless of whether they use this app. That query uses one exact primary key and returns only those fields. Other connector operations include PUBLIC inventory mutations. Firebase client configuration and API keys are not secrets or authorization. Review the exposure, quotas and potential abuse/cost with the project owner before deploying; if this data is sensitive, use authenticated authorization and appropriate access controls instead. Do not put service-account keys, Admin credentials or other secrets in the app or Expo environment variables.

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

The scanner uses Code 128 and sends the scanned string verbatim as `productID`, including spaces and leading zeros; there is no separate barcode mapping. Confirm that this matches the seeded records. Lookups require connectivity; a missing product, invalid response, unavailable service or timeout does not yield acceptance. Scan again or retry as appropriate. A timeout or new scan stops waiting for the previous query but cannot cancel the underlying Data Connect request.

## Location operations

The grid and commands use Data Connect directly; there is no command service URL or HTTP fallback. See `location/CONTRACT.md` for the exact mutation variables and snapshot shape. The Firebase owner must align/deploy the simplified state/binding-guarded `@transaction` operations separately. Inventory is staff-confirmed, not physically sensor-verified.

Commands contain only action, productID, sourceSlotID, and targetSlotID. There are no versions, operation IDs, operation-ledger lookups, or durable command journals. Confirmation, submission, and refresh disable repeat taps and Scan again. Every mutation outcome refreshes inventory. On error or timeout, the app asks staff to check inventory and the physical product rather than automatically retrying. A timed-out transaction may still complete; there is no exactly-once/restart/replay guarantee. Refresh remains available after the bounded wait, without an indefinitely pending operation. Expired-scan rejection is attempted once per deliberate scan and is not automatically retried on uncertainty. Local tests do not establish deployed cloud behavior or physical-device acceptance.

## Decision limitations and verification

The app calculates expiry using the **phone's local calendar date**. A valid expiry date is eligible through that date, earlier dates are expired, and missing/invalid dates are unknown. Device clock errors or tampering, client modifications and stale data can produce an incorrect decision: this is an MVP trade-off, not trusted server-side authorization. Staff must verify eligibility before put-away.

Automated tests cover response validation and local date boundaries but do not contact Firebase or exercise the camera. Before operational use, deploy to an isolated test project and test the actual Android/iOS Expo runtime, camera, network failures, timeout/retry and known/missing products. Check yesterday/today/tomorrow and missing expiry fixtures using the phone's local date, verify the public operation's access and returned fields, and verify the expected stock, slot and activity changes through the isolated service. Native runtime and deployed schema/data are not verified by these local tests.

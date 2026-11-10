# Receiving scanner

The Expo app reads stock directly with the Firebase JavaScript Data Connect SDK. It does not call or remove `app/backend`, and it does not write inventory. It uses `queryRef` and `executeQuery` with the deployed `GetStockByProductID` operation (the same API used by the generated SDK); the operation name, variables, response shape, connector, service and region in `receiving.ts` must match `firebase/dataconnect/example/queries.gql` and the deployed connector. See the [Firebase web SDK guide](https://firebase.google.com/docs/data-connect/web-sdk). No generated SDK installation is required by this app.

## Security and deployment

`GetStockByProductID` is deliberately **PUBLIC** and unauthenticated. Anyone who knows or guesses a product ID can repeatedly query its ID, description and expiry, regardless of whether they use this app. The operation uses one exact primary key and returns only those fields; it has no list or mutation operation. Firebase client configuration and API keys are not secrets or authorization. Review the exposure, quotas and potential abuse/cost with the project owner before deploying; if this data is sensitive, use authenticated authorization and appropriate access controls instead. Do not put service-account keys, Admin credentials or other secrets in the app or Expo environment variables.

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
EXPO_PUBLIC_STORE_TIMEZONE=Asia/Singapore
```

The timezone is an **example**, not a confirmed store setting: use the store's actual IANA timezone and confirm its expiry policy before use. Expo embeds `EXPO_PUBLIC_` values in the client; configure them for builds as well and fully reload after changes. From `app/UI`:

```sh
npm ci
npm run typecheck
npm test
npm run lint
npx expo start
```

The scanner uses Code 128 and sends the scanned string verbatim as `productID`, including spaces and leading zeros; there is no separate barcode mapping. Confirm that this matches the seeded records. Lookups require connectivity; a missing product, invalid response, unavailable service or timeout does not yield acceptance. Scan again or retry as appropriate. A timeout or new scan stops waiting for the previous query but cannot cancel the underlying Data Connect request.

## Slot picker limitations

After an eligible scan, the app shows the eight-slot grid and Remove Product button. The current schema does not store physical sensor occupancy or pending removal IDs, so all slots are labeled **Unknown** and disabled; an unassigned slot is not proof it is physically empty. The removal button is also disabled. No reservation, receipt, removal, or inventory write is implemented. The query requires all eight slot rows to exist, otherwise the app shows a retryable error. Do not deploy the public query without approving the exposure of assignments.

## Decision limitations and verification

The app calculates expiry locally using the **device clock** and the configured store timezone. A valid expiry date is eligible through that date, earlier dates are expired, and missing/invalid dates are unknown. Invalid or unsupported timezone configuration blocks the lookup. Device clock errors or tampering, client modifications, stale data and a wrong timezone can produce an incorrect decision: this is advisory only, not trusted authorization. Staff must verify eligibility before put-away. It never records receipt; any future inventory write must revalidate on a trusted server transactionally. The previous backend used its server clock instead.

Automated tests cover response validation, date boundaries and timezone conversion but do not contact Firebase or exercise the camera. Before operational use, deploy to an isolated test project and test the actual Android/iOS Expo runtime, camera, network failures, timeout/retry and known/missing products. Check yesterday/today/tomorrow and missing expiry fixtures in the confirmed timezone, verify the public operation's access and returned fields, and ensure no stock, slot or activity records change. Native runtime and deployed schema/data are not verified by these local tests.

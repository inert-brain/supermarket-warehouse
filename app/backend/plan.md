# Firebase Expiration Validation — Implementation Plan

## Goal and scope

Add a small TypeScript backend in `app/backend` that looks up a scanned product in Firebase Data Connect and rejects expired products for receiving. The Expo app displays the backend decision. No stock, slot, or activity writes in this phase; no SQLite synchronization or end-user authentication.

## Existing integration targets

- Firebase project: `smart-warehouse-3171e`.
- Data Connect service: `smart-warehouse-service`, region: `asia-southeast1`.
- Database: `smart-warehouse-database`; current schema: `firebase/dataconnect/schema/schema.gql`.
- Lookup the existing `Stock` type using its string `productID`; return `productID`, `description`, and `expiresOn`. Preserve existing SQL column mappings and relationships.

## Decisions to confirm

- Treat scanned barcode text as `productID` for this prototype. Confirm this matches the seeded records; otherwise add a deliberate barcode mapping rather than guessing the product.
- Proposed policy: date-only expiry is valid through its stated date. Reject when `expiresOn < today` in a configured store IANA timezone. Confirm the timezone and policy before implementation; do not silently use the server or phone timezone.
- Because `expiresOn` is nullable, missing expiry produces `EXPIRY_UNKNOWN` and blocks acceptance pending staff verification. It must not be interpreted as unexpired.

## Implementation steps

1. **Backend setup:** Create a minimal Node.js + TypeScript HTTP service with a start command, typecheck command, test command, and configuration for project, service, region, store timezone, and port. Keep database access, expiry rules, and HTTP handling separate.
2. **Firebase access:** Use the supported server-side Firebase Admin SDK Data Connect read API for a parameterized product lookup. Confirm the installed SDK supports that API. Use Application Default Credentials for local development and a runtime identity when deployed; document setup and required IAM access. No mobile user authentication is needed for this phase, but server credentials are still required. Never commit credentials or send them to Expo. Do not expose a public database query just to bypass authentication.
3. **Validation endpoint:** Add `POST /receiving/validate` accepting `{ "barcode": "WH-PROD-001" }`. Require a non-empty string and preserve its exact value, including leading zeros. Query only the matching product, not the entire database. Keep the configured service target server-side; never accept arbitrary GraphQL from clients.
4. **Expiry rule:** Implement a pure decision function with an injected current date for deterministic tests. Compare validated calendar dates in the store timezone, without converting a date-only expiry into an unintended UTC cutoff. Return `READY_FOR_PUTAWAY`, `EXPIRED`, or `EXPIRY_UNKNOWN`, alongside product details when available. Acceptance means eligible for put-away, not received into stock.
5. **Error contract:** Return 400 for invalid input, 404 for `PRODUCT_NOT_FOUND`, and 503 for Firebase unavailability. Return a successful validation response with an explicit decision for known products; technical failures must never become acceptance. Avoid leaking credentials or internal errors.
6. **Expo integration:** After a scan, call the endpoint once, show loading, then show the exact product details and decision. Show rejection for expired products, verification guidance for missing expiry, and clear retry guidance for lookup failures. Keep the scan locked until staff choose to scan again. Configure the backend URL separately; on a physical Android phone use the development computer's reachable LAN address, not `localhost`. Document any development HTTP restrictions; prefer HTTPS and avoid globally disabling transport security.

## Verification

- Unit tests: yesterday → `EXPIRED`; today and tomorrow → `READY_FOR_PUTAWAY` under the proposed policy. Include store-midnight boundaries, missing/invalid expiry, and string IDs with leading zeros.
- Endpoint tests: found, unknown barcode, invalid input, and Firebase failure. Assert that validation performs no writes.
- Cloud integration: verify the deployed schema is compatible, then seed dedicated test products expiring yesterday, today, and tomorrow relative to the store date. Use `WH-PROD-001` as the expired fixture and separate IDs for the others; avoid overwriting operational records.
- Manual Android check: scan each matching Code 128 barcode and verify product details and the expected decision; test an unknown barcode and an unavailable backend. Confirm all inventory and slot values remain unchanged.

## Deferred

Sensor integration, slot selection/reservation, receipts, shelf transfers, dispatch, disposal, and inventory mutations. Future receiving mutations must recheck expiry and current state transactionally; this validation response is not lasting authorization to receive. Restrict the unauthenticated prototype to controlled development access rather than exposing it publicly.

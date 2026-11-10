# Receiving validation backend

A Node.js/TypeScript prototype that reads one `Stock` by `productID` using Firebase Admin Data Connect. It performs **no inventory writes**. `READY_FOR_PUTAWAY` means eligible at the time of validation, not received or authorized indefinitely. Future receiving writes must revalidate transactionally.

## Before use

- Confirm with the store that expiry is valid through the stated calendar date and set the actual store's IANA timezone. There is deliberately no timezone default. `Asia/Singapore` below is an example, not a confirmation.
- Confirm scanned barcode text is exactly the seeded `productID`. This prototype uses it verbatim, including spaces and leading zeros; it does not resolve a separate barcode mapping. The deployed schema and seed data have not been verified by the automated tests.
- This endpoint has **no client authentication**. Restrict it to controlled development access; never expose it publicly. Default binding is loopback. Use network controls, authentication and HTTPS before any broader deployment. The Admin API bypasses Data Connect auth directives; credentials must stay on the server.

## Setup and configuration

Requires Node.js 20 or newer. From `app/backend`:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Set environment variables in your shell or deployment environment; the backend does not automatically load `.env` files. For example, after confirming the timezone:

```sh
export STORE_TIMEZONE=Asia/Singapore
npm start
```

| Variable | Default | Description |
| --- | --- | --- |
| `STORE_TIMEZONE` | required | Explicit IANA timezone supported by Node/ICU; controls the calendar date. |
| `FIREBASE_PROJECT_ID` | `smart-warehouse-3171e` | Firebase project. |
| `DATA_CONNECT_SERVICE_ID` | `smart-warehouse-service` | Data Connect service. |
| `DATA_CONNECT_LOCATION` | `asia-southeast1` | Service region. |
| `HOST` | `127.0.0.1` | Bind interface; change only with appropriate network restrictions. |
| `PORT` | `8080` | TCP port, 1–65535. |

The server uses Application Default Credentials (ADC). For local development, use `gcloud auth application-default login` with an authorized development identity, or use a properly secured ADC configuration. In Google Cloud, attach a dedicated runtime service account; use workload identity when appropriate. Do not commit keys or send credentials to the app. Grant the identity `firebasedataconnect.services.executeGraphqlRead` on the target service/project, e.g. via the read-only `roles/firebasedataconnect.dataViewer` role (which includes additional read permissions). The ordinary Data Connect API Viewer role does **not** grant data access. See [IAM roles and permissions](https://cloud.google.com/iam/docs/roles-permissions/firebasedataconnect) and [ADC setup](https://cloud.google.com/docs/authentication/provide-credentials-adc). Ensure the Data Connect API and target service are available. `DATA_CONNECT_EMULATOR_HOST` may be used with the Admin SDK for local emulator testing; never accidentally point a test at production.

The fixed, parameterized query uses Admin SDK `executeGraphqlRead`, not a public connector or a client-supplied GraphQL document. See the [Admin SDK guide](https://firebase.google.com/docs/data-connect/admin-sdk), [API reference](https://firebase.google.com/docs/reference/admin/node/firebase-admin.data-connect.dataconnect), and [key query syntax](https://firebase.google.com/docs/data-connect/queries-guide).

## API

`POST /receiving/validate` accepts JSON with a non-empty string `barcode`. Values are not trimmed or converted to numbers.

```sh
curl -X POST http://127.0.0.1:8080/receiving/validate \
  -H 'Content-Type: application/json' \
  -d '{"barcode":"WH-PROD-001"}'
```

For a known product, HTTP 200 contains, for example:

```json
{"decision":"EXPIRED","product":{"productID":"WH-PROD-001","description":"Example","expiresOn":"2026-03-09"}}
```

`decision` is `READY_FOR_PUTAWAY` if the valid date is today or later in the configured timezone, `EXPIRED` if earlier, and `EXPIRY_UNKNOWN` if missing or invalid; unknown blocks acceptance pending staff verification. `description` and `expiresOn` may be null. Errors are JSON objects with `error`: 400 `INVALID_INPUT`, 404 `PRODUCT_NOT_FOUND`, 503 `LOOKUP_UNAVAILABLE`; malformed or failed upstream responses never yield acceptance. Other routes return 404 `NOT_FOUND`, wrong methods 405 `METHOD_NOT_ALLOWED`, and bodies over 8 KiB 413 `BODY_TOO_LARGE`. Responses are not cached.

For a physical Android device, the separately configured app URL must use the development computer's reachable LAN address, not phone `localhost`. Set `HOST` to a suitable reachable interface only on a controlled network. Prefer HTTPS; Android development builds may otherwise block cleartext HTTP, so use a narrowly scoped development-only exception if needed, never a global transport-security bypass. See `../UI/README.md` for the Expo scanner configuration.

## Integration verification still required

With approved credentials and an isolated test environment, verify the deployed schema supports the fixed key query and the scanned values match records. Seed dedicated fixtures expiring yesterday, today and tomorrow in the confirmed store timezone, avoiding operational records (the plan proposes `WH-PROD-001` for the expired fixture). Test those plus a missing expiry, an unknown barcode and backend unavailability. Check that stock, slot and activity values remain unchanged. Then test the intended app flow on Android. The automated tests use injected fakes and do not contact Firebase or verify deployed IAM/schema.

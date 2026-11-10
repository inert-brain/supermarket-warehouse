# Receiving validation backend

A Node.js/TypeScript prototype with a read-only receiving validation endpoint and a PostgreSQL-backed location command service. `READY_FOR_PUTAWAY` is advisory; commands independently revalidate inventory and expiry in a transaction.

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

## Location command service

Set `DATABASE_URL` to an explicitly chosen PostgreSQL connection string for the same database as Data Connect. Without it, receiving validation remains available but location routes return 503. Use a dedicated least-privilege database role with SELECT/UPDATE on `stocks` and `slots`, SELECT/INSERT on `activities` (and usage on its serial sequence), and SELECT/INSERT/UPDATE on `location_operations`. Use a local Cloud SQL Auth Proxy or another secured PostgreSQL endpoint; configure verified TLS according to your proxy/driver setup. Firebase ADC does not provide PostgreSQL database credentials. Do not put this URL in the app or logs. No managed connector is included. The database must be migrated separately before enabling commands; this backend does not create or modify schema. Required additions are `stocks.version` and `slots.version` integer NOT NULL DEFAULT 0, plus `location_operations(operation_id text primary key, payload jsonb, outcome text, result jsonb, completed_at timestamptz)`. Existing columns must match the names in the location plan, including `activities(product_id, activity_type, occurred_at)` and its default serial key. Preserve the existing assignment unique constraint and foreign keys. Review and repair existing inconsistent records separately; never reset operational data. Confirm migration and permissions in an isolated database first.

The server uses a bounded pool (10 connections), acquisition and statement timeouts. All writes are unauthenticated: keep loopback or a restricted development network and do not deploy publicly without approval, authentication and HTTPS. This records app-confirmed inventory, not rack verification. `STORE_TIMEZONE` is required and controls expiry using the server clock; the expiry date is valid through the end of that store calendar day. Take-off remains possible for expired stock; place, return, move and dispatch require valid expiry. `RecordExpiredScan` only records a rejection and does not dispose of stock.

### JSON contract

All responses have `Cache-Control: no-store`. `POST /location/commands` accepts exactly:

```json
{"operationID":"df04d58a-4da0-45f5-acbe-9a274e2e9a01","action":"PlaceProduct","productID":"WH-PROD-001","productVersion":0,"source":null,"target":{"slotId":1,"version":0}}
```

`operationID` is a UUID; product ID is preserved verbatim, nonblank and at most 512 characters. Versions are nonnegative 32-bit integers, and slot IDs are 1–8. `PlaceProduct` requires null source and a target; `MoveProduct` requires distinct source and target; `TakeOffRack`, `ReturnProduct` and `DispatchProduct` require source and null target. `RecordExpiredScan` requires null target and source if and only if the product is bound. Every token is exactly `{ "slotId": number, "version": number }`. No extra fields are accepted.

A terminal response is HTTP 200 for both commits and business conflicts:

```json
{"operationID":"df04d58a-4da0-45f5-acbe-9a274e2e9a01","command":{"operationID":"df04d58a-4da0-45f5-acbe-9a274e2e9a01","action":"PlaceProduct","productID":"WH-PROD-001","productVersion":0,"source":null,"target":{"slotId":1,"version":0}},"outcome":{"status":"committed","message":"OK"}}
```

Conflict outcomes have `status: "conflict"` and `message` one of `PRODUCT_NOT_FOUND`, `STALE_PRODUCT`, `INCONSISTENT_INVENTORY`, `STALE_SOURCE`, `STALE_TARGET`, `EXPIRY_UNKNOWN`, `EXPIRY_MISMATCH`, `INVALID_TRANSITION`. They are persisted and replayed unchanged. Reusing an ID with different payload returns HTTP 409 `{"error":"OPERATION_ID_MISMATCH"}`. Malformed input returns 400 `INVALID_INPUT`, oversized bodies 413 `BODY_TOO_LARGE`. Database errors return 503 `{"error":"LOCATION_UNAVAILABLE","retryable":true}` without details; the outcome may be uncertain, so retry or reconcile the **same** immutable command and ID. No automatic server retry is performed.

`GET /location/operations/:id` returns the same terminal object or HTTP 200 `{"operationID":"...","status":"unresolved"}`. An unresolved response does not prove an in-flight transaction cannot commit; keep the durable command and retry the same ID. `GET /location/snapshot?productID=...` returns 404 `PRODUCT_NOT_FOUND` or HTTP 200 `{ "product": { "productID": string, "status": "EMPTY" | "OCCUPIED" | "PENDING_DISPATCH", "version": number, "expiry": "valid" | "expired" | "unknown" }, "slots": [{ "slotId": number, "productID": string | null, "assignedAt": string | null, "version": number, "status": string | null }] }`. The snapshot is read in a read-only repeatable-read transaction; clients must validate all eight slots and bindings before presenting actions. Query parameters are URL encoded. Wrong methods return 405 and unknown routes 404.

Lock order is ledger ID, the requested stock and all stocks discovered in bound slots in `product_id COLLATE "C"` order, then all slot rows in ascending ID order. The initial binding discovery is unlocked: if a new binding appears before the slot locks are obtained, the transaction rolls back and retries up to twice with the same ID; continued contention returns retryable 503. Every bound slot must reference an existing stock in `OCCUPIED` or `PENDING_DISPATCH`; malformed bindings result in `INCONSISTENT_INVENTORY`. Checked updates, activity insertion, and terminal ledger result are atomic. An activity failure rolls back the entire operation. SQL errors, timeouts and lost responses are not business conflicts. Retain ledger rows indefinitely.

**All external inventory writers must participate in the same concurrency protocol.** They must lock relevant stock rows in `product_id COLLATE "C"` order before locking affected slot rows in ascending `slot_id` order, preserve stock/slot consistency atomically, and increment every changed stock and slot version in the same transaction. This includes status, expiry, assignment, and other changes that affect command eligibility or snapshot preconditions. Writers that skip version increments can make stale commands appear current; writers that ignore the lock order can cause deadlocks or undermine consistency. Database privileges and operational procedures must enforce this requirement; this service cannot guarantee safety against non-participating writers.

For optional PostgreSQL integration tests, set `LOCATION_TEST_DATABASE_URL` to a **disposable isolated database** whose user may create/drop schemas, then run `npm test`. The suite creates and drops a randomly named private schema. Never use operational data. Without that variable the PostgreSQL suite is skipped.

## Integration verification still required

With approved credentials and an isolated test environment, verify the deployed schema supports the fixed key query and the scanned values match records. Seed dedicated fixtures expiring yesterday, today and tomorrow in the confirmed store timezone, avoiding operational records (the plan proposes `WH-PROD-001` for the expired fixture). Test those plus a missing expiry, an unknown barcode and backend unavailability. Check that stock, slot and activity values remain unchanged. Then test the intended app flow on Android. The receiving tests use injected fakes; the optional PostgreSQL tests use a disposable schema. Neither verifies deployed Firebase IAM or the deployed schema.

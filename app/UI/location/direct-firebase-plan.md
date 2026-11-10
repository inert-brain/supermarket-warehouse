# Migration Plan: Phone → Firebase Data Connect, No Local Backend

> Historical migration plan, superseded by [CONTRACT.md](CONTRACT.md) for the single-phone MVP. Direct Firebase remains, but versions, LocationOperation, UUIDs, AsyncStorage journals, and reconciliation have been removed from the app. Current commands use only action/productID/sourceSlotID/targetSlotID, expiry uses the phone date, and uncertain outcomes refresh state without automatic resend. The Firebase owner implements state/binding-guarded `@transaction` mutations separately; do not follow the obsolete schema/protocol requirements below.

## 1. Required result

The Android app must work with internet access after deployment, without a running laptop, local Node server, LAN IP address, Cloud SQL proxy on the phone, or EXPO_PUBLIC_LOCATION_COMMAND_URL.

```text
Expo phone app
  → Firebase JavaScript SDK / deployed connector operations
  → Firebase Data Connect
  → Cloud SQL PostgreSQL
```

“Move the backend to the phone” means moving orchestration into the mobile adapter and replacing HTTP endpoints with hosted Data Connect operations. It does **not** mean putting PostgreSQL credentials, Firebase Admin, pg, raw SQL execution, or trusted validation in the phone. The cloud still enforces atomicity, eligibility, and concurrency.

This plan supersedes the command-service architecture in buttons-plan.md. Do not introduce another required custom server as an undocumented fallback. If a required guarantee cannot be expressed in Data Connect, report the specific verified limitation and request a scope/architecture decision before proceeding.

## 2. Reuse the work already implemented

Keep:

- Scanner, permissions, Code 128 support, exact barcode strings, and expiry display.
- LocationWorkflow, core.ts state mapping, 4×2 grid, confirmations, and full-width Remove Product.
- AsyncStorage command journal, expo-crypto UUIDs, immutable command IDs/payloads, and recovery UI.
- Stock/Slot versions and LocationOperation ledger already declared in schema.gql. Their actual cloud migration status must be checked.
- Existing enums and SQL column mappings. Do not reset data or recreate tables.
- Backend/PostgreSQL tests as behavioral reference until equivalent connector tests pass. Existing app/backend may remain as unused development/reference code; deleting it is not required for this migration.

Replace:

| Current implementation | Direct Firebase replacement |
|---|---|
| GET /location/snapshot | Parameterized connector query for product, bindings, joined statuses, and versions |
| POST /location/commands | Six fixed transactional connector mutations |
| GET /location/operations/:id | Exact-key operation-result query |
| HTTP terminal-response envelope | Validated adapter-normalized outcome assembled from connector results |
| PostgreSQL row-lock implementation | Proven conditional version writes, affected-row checks, transaction rollback, and unique constraints |
| Node server date calculation | Trusted PostgreSQL/Data Connect eligibility evaluation |
| EXPO_PUBLIC_LOCATION_COMMAND_URL | Existing Firebase configuration and service/region/connector identifiers only |

## 3. Non-negotiable state mapping

| Command | Stock transition | Slot change | Activity |
|---|---|---|---|
| PlaceProduct | EMPTY → OCCUPIED | Bind target, set assignedAt | ON_RACK |
| TakeOffRack | OCCUPIED → PENDING_DISPATCH | Keep assignment/time | OFF_RACK |
| ReturnProduct | PENDING_DISPATCH → OCCUPIED | Keep assignment/time | ON_RACK |
| MoveProduct | OCCUPIED/PENDING_DISPATCH → OCCUPIED | Clear source assignment/time, bind target | ON_RACK |
| DispatchProduct | PENDING_DISPATCH → EMPTY | Clear source assignment AND assignedAt | DISPATCHED |
| RecordExpiredScan | Unchanged | Unchanged | REMOVED |

Change stock statusUpdatedAt and product/affected-slot versions on actual location transitions. Take-off and return increment retained slot version despite unchanged assignment. Move releases source before binding target in the same transaction. RecordExpiredScan changes no stock/slot fields, timestamps, or versions. Same-slot OCCUPIED selection is a no-op.

Retain product binding while off-rack so its ID stays visible and the slot remains reserved. Derive warehouse count from OCCUPIED + PENDING_DISPATCH, not activity counts. Expired scan rejection is not confirmed disposal. One product is one inventory unit; no box/quantity model.

## 4. First milestone: prove the connector primitives

Before replacing working transport or writing six mutations, build one small isolated capability test with current Firebase docs, generated operation types, and the Data Connect emulator/compiler. Do not treat illustrative GraphQL snippets as verified syntax.

Prove:

1. @transaction rolls back stock, slot, activity, and ledger writes when a later field/check fails.
2. Conditional stock_updateMany/slot_updateMany predicates can include key, expected version, current status/binding, and null assignment checks. Verify the returned value is an affected-row count and @check(expr: "this == 1") rejects zero.
3. Version increment syntax and request-time assignments compile and execute as expected.
4. A unique operation-ID insert cannot overwrite an existing command; collision aborts the whole duplicate transaction. Never use upsert to replace an outcome.
5. An exact-key ledger query returns committed payload/result, and the SDK error shape distinguishes explicit rejection from an unknown network outcome.
6. Trusted date-only expiry in a configured store timezone is usable inside the transaction and protected against concurrent eligibility edits.
7. Actual concurrency under competing requests rejects losers without partial history. A read-only @check is not a row lock; expected state/version must be in the conditional writes themselves.

Deliver the actual compiling operation documents and integration tests from this milestone. Test production-like concurrency in a disposable Data Connect/Cloud SQL environment after emulator tests; local compilation alone does not prove runtime isolation behavior.

## 5. Read contract

Add or extend a GetLocationSnapshot($productID: String!) query to return:

- Exact Stock record: productID, currentStatus, version, expiresOn, description.
- All eight Slot rows: slotId, productID, assignedAt, version, and joined stock productID/currentStatus.
- All bindings of the requested product, including unexpected out-of-range bindings, to detect inconsistent legacy data.

Keep existing queries for other consumers until migrated. Add versions to existing queries where needed. An absent product is not an EMPTY product.

Map the response to the existing Snapshot type and use validateSnapshot. Check that each slot 1–8 occurs once, assignments/timestamps match, bindings are unique, bound products are OCCUPIED/PENDING_DISPATCH, and the scanned product's status agrees with its binding. Reject unexpected data; do not invent versions or normalize missing rows into green slots.

Data Connect multi-field reads are not documented as consistent snapshots. Treat them as advisory: server-only fetch, one bounded refresh on an apparent mismatch, then show retry/repair guidance. The write operation independently validates current state. Do not claim to preserve the backend's REPEATABLE READ semantics automatically.

## 6. Trusted expiry without a Node service

Keep valid-through-date semantics using the actual confirmed store IANA timezone. EXPO_PUBLIC_STORE_TIMEZONE remains useful for display, but must not control trusted write eligibility.

Preferred investigation: a schema-declared SQL-backed eligibility view, evaluated by PostgreSQL using CURRENT_TIMESTAMP converted to a trusted configured timezone, exposing product ID, valid/expired/unknown eligibility and the corresponding product version. A deployment-owned timezone constant/configuration must be inaccessible to public client mutation. Verify Data Connect @view support, generated names, relationships, and use of the view in a transaction before adopting it.

Alternative: a documented server-side CEL/request.time expression that performs the same store-calendar comparison, if supported and tested. Do not invent timezone/date conversion syntax or accept a phone-supplied today/eligible flag as authority.

A preliminary eligibility read does not protect against another writer changing expiry. Make all eligibility edits increment product.version and enforce a conditional product write against that version, or include the exact observed expiry in the guarded predicate. For RecordExpiredScan, establish an equivalent guard without changing Stock.version; prove isolation or conditional-insert behavior. If this cannot be guaranteed with the current platform, report the limitation before weakening the rule.

Test yesterday, today, tomorrow, null expiry, store midnight, daylight-saving changes where applicable, and an incorrect phone clock. TakeOffRack does not require unexpired stock; placement, return, move, and normal dispatch do.

## 7. Six transactional mutations

Define a separate narrow operation for each command; do not expose a generic CRUD/status/activity mutation. The caller supplies operation ID, product ID, expected product version, and applicable source/target IDs and versions. Activity type and next status are fixed by the operation, never arbitrary caller inputs.

Every operation must implement this logical unit using proven connector syntax:

1. Claim the operation ID by insert, storing the canonical action and full immutable payload. The claim must remain invisible if the transaction fails.
2. Validate product existence, allowed status, exact binding, slot range, versions, and trusted expiry as appropriate. Reject invalid source/target shapes.
3. Perform conditional product and affected-slot writes; require exactly one affected row each. Increment versions. For move, clear source before target assignment to honor uniqueness. Ensure all command writers participate in the same product/slot version protocol.
4. Insert the fixed Activity with request.time. Do not insert an event before knowing checks can roll back atomically. No activity for no-op or rejected transition.
5. Persist the committed outcome and canonical payload in LocationOperation, using server completion time, and return enough data to validate/reconcile the result.
6. Roll back everything on checks, unique constraint errors, or activity failures.

Do not simulate backend FOR UPDATE behavior with unchecked queries. Test races over source, destination, and product versions. Pre-existing unrelated bad slot records should fail closed in the UI; decide and test how the command enforces rack invariants without falsely claiming a read snapshot locks all rows. Never let two bindings or an EMPTY-with-binding state commit.

## 8. Replay and conflict protocol

The existing SQL backend stores both committed and business-conflict outcomes. Do **not** assume a failed @check can commit a conflict ledger row: it rolls back the transaction. Explicitly resolve this contract difference.

Implement the simplest proven direct-connector protocol:

- Committed commands always leave exactly one immutable ledger entry with canonical payload and result.
- Before retry and after an ambiguous/duplicate response, query that exact ID and compare every command field. Matching committed entry → return original success. Different payload → block with operation-ID mismatch.
- Missing entry or a transport error is unresolved, not proof of failure. Keep durable command and retry/reconcile the same ID.
- A definitive connector business rejection may become a terminal conflict only once tests establish it cannot race with an earlier successful submission of the same ID. Prefer a supported transaction branching/claim protocol that persists conflict outcomes too if available. If not, adjust the adapter outcome contract with an explicitly tested reconciliation path; never guess a conflict and clear the journal while an earlier request may commit.
- Do not regenerate IDs on automatic retry, overwrite ledger entries, clear history, or delete ledger entries during prototype use. A new deliberate action can use a new ID only after the previous action is definitively resolved.
- RecordExpiredScan is one operation per deliberate scan session. Persist its ID/payload before submitting; repeated callbacks and app recovery reuse it. Rejection history cannot be fabricated from a local alert.

Test simultaneous identical IDs, identical ID/different payloads, duplicate mutation errors, connection loss before/after commit, failed checks, and reads while an earlier mutation is still in flight. This is a release gate, not optional polish.

## 9. Refactor the mobile adapter without rewriting the UI

Split transport from journal handling in location/service.ts:

- Keep serialization, command parsing, payload equality, durable prepare/pending/clear, and verified-terminal safeguards.
- Inject a Firebase transport with readSnapshot, executeCommand, and getOperation methods instead of fetch/baseURL.
- Use generated typed SDK functions where practical; otherwise typed queryRef/mutationRef names must match deployed documents exactly. Use server-only reads for decisions/reconciliation.
- Configure it in location/adapter.ts using the existing initialized Firebase app, service, region, and connector from receiving.ts. Avoid creating conflicting duplicate Firebase initializations.
- Preserve AbortSignal cancellation of waiting and stale-result protection. Firebase cancellation/timeout may stop waiting without canceling the hosted mutation; mark results unknown and retain the journal.
- Enforce timeout through full SDK completion. Do not turn malformed results, network errors, or missing ledger rows into committed/conflict responses.
- Remove the command URL validation and EXPO_PUBLIC_LOCATION_COMMAND_URL requirement after the direct adapter is validated. There must be no hidden fallback to a LAN/backend URL.

The UI can retain its action/confirmation flow. It should refresh stock and slots after commit/conflict/foreground return, disable writes while unresolved, show actionable connector errors, and leave assigned IDs visible until a binding is actually cleared.

## 10. Dependencies and access policy

Most required packages already exist: firebase, expo-camera, expo-crypto, and AsyncStorage. Run npm ci in app/UI; do not add pg, Firebase Admin, Node HTTP libraries, cloud SQL connectors, or service-account keys to the phone. Keep secrets out of EXPO_PUBLIC_ variables. Match Firebase/Expo package compatibility before changing versions.

No end-user authentication is requested. Narrow PUBLIC operations still allow anyone who can invoke them to change inventory. Fixed operations, CAS, and idempotency prevent invalid transitions, not unauthorized callers. Obtain explicit approval for PUBLIC write deployment in an isolated test project; document exposed read fields and operation-ledger privacy. Do not expose a list of all operation payloads if exact-key reconciliation is sufficient. No arbitrary SQL or all-row update/delete operation in the connector.

## 11. Migration and deployment sequence

1. Preserve current working files and inspect target project/service/connector. Do not reset or delete test data as part of deployment.
2. Implement/validate the capability milestone and direct operations locally with no UI cutover yet.
3. Review actual cloud schema against local schema.gql: version defaults, ledger fields, unique product binding, enum values, and SQL-only constraints. Review firebase dataconnect:sql:diff before applying any needed migration. Data Connect strict migration must not silently remove separately maintained constraints/views.
4. Extend connector queries/mutations/eligibility definitions. Compile and test. Generate SDK if used and keep generated operation names/types aligned with app calls.
5. After explicit deployment/security approval, run from firebase/: firebase dataconnect:sql:migrate --project smart-warehouse-3171e for reviewed required changes, then firebase deploy --only dataconnect --project smart-warehouse-3171e. Do not deploy unrelated connector changes blindly.
6. Verify GetLocationSnapshot, operation lookup, and every command exist in the intended connector. Operation-not-found is a deployment/configuration problem, not grounds to reintroduce a local service.
7. Switch the app adapter to Firebase, remove the command URL dependency, restart/reload Expo, and test on physical Android.
8. Keep backend files unused initially; removal/archival is a separate optional cleanup after parity tests. Stop the local backend during final acceptance. Document that migration/CLI tools are development-time only.

## 12. Required tests and definition of done

Automated:

- Preserve all current pure transition, scan, journal, malformed-response, timeout, and stale-result tests.
- Add mocked SDK adapter tests and real emulator integration tests proving operation results and rollback.
- Port PostgreSQL behavioral scenarios to actual Data Connect operations: placement, take-off, return, move, dispatch, expired rejection, unknown product/expiry, same-slot no-op, stale versions, competing slot claims, move versus dispatch, activity-insert failure, and replay after response loss/restart.
- Verify state + slot + activity synchronization after each command, including both assignment fields clearing on dispatch/move source.
- Test trusted timezone logic and wrong device clock; all actual writers must increment versions when changing state/eligibility.
- Run npm test, npm run typecheck, npm run lint, Android export, and connector compiler. State which tests ran against emulator versus deployed cloud; neither substitutes for the other automatically.

Physical acceptance:

1. Install/run the app, then stop every local backend and proxy process. Use mobile data or a different Wi-Fi network with internet, not the development LAN.
2. Scan eligible EMPTY fixture → select green slot → verify OCCUPIED + binding + one ON_RACK event.
3. Take off → PENDING_DISPATCH + retained binding + one OFF_RACK. Return → OCCUPIED + same binding/time + ON_RACK.
4. Move → old slot's productID/assignedAt null; new binding/time populated; warehouse count unchanged.
5. Take off then Remove Product → EMPTY + cleared binding/time + exactly one DISPATCHED event. Repeat/recover after lost response without a second departure.
6. Expired scan → one REMOVED rejection per scan session; no inventory/binding change. Observe same behavior with incorrect phone clock when trusted service decides eligibility.
7. Confirm no EXPO_PUBLIC_LOCATION_COMMAND_URL, DATABASE_URL, laptop IP, pg client, or Admin credentials are required by the phone.

Done means every enabled button performs verified cloud transactions directly through Firebase with no locally running command service. If a platform capability blocks that result, stop and explain the exact tested gap rather than shipping preview-only buttons as complete or quietly reinstating a backend.

# Plan: Make Every Location Button Functional

> Historical plan, superseded by [CONTRACT.md](CONTRACT.md) for the single-phone MVP. The app no longer uses a command server, versions, UUIDs, a durable journal, or ledger recovery. Do not install the journal dependencies or follow the backend/migration steps below for the current app. Firebase transactions are owned separately.

## Outcome

Replace `locationAdapter = null` with a working adapter. Eligible scans can select a green slot; stored products can be taken off, returned, moved, or dispatched; expired scans can log rejection. Every accepted action keeps Stock, Slot, and Activity synchronized. Preserve the current StockStatus and ActivityType enums exactly, the product IDs, the grid, and the existing barcode flow.

This is app-confirmed inventory for the prototype. Rack verification remains a later phase. One product is one inventory unit.

## 1. Implementation decision: stop blocking on unproven connector writes

Keep the existing direct Data Connect reads. Implement location **commands through the existing TypeScript backend**, using a real PostgreSQL transaction against the same Cloud SQL database. This is a deliberate, narrow exception to direct-only Firebase access: read-only Firebase SDK calls cannot perform the required writes, and the current adapter is disabled because the connector transaction/replay path has not been completed.

Do not build a second database or sync SQLite. Do not duplicate product data. A cloud-hosted command service is preferable for phone testing; a locally running backend on a controlled LAN is acceptable for development. This adds one runtime component, but gives the implementation a concrete, testable SQL transaction boundary rather than another permanently disabled placeholder.

The next implementation must deliver the command service, adapter, migration, tests, and run instructions together. If an actual infrastructure/configuration problem prevents live use, report that exact problem; do not describe disconnected UI code as fully functional.

## 2. Dependencies and configuration

- Reuse `app/backend` Node.js + TypeScript service; retain its existing expiry endpoint unless explicitly replacing it.
- Add `pg`, `@types/pg`, and, for managed Cloud SQL connectivity, `@google-cloud/cloud-sql-connector`. Pin compatible versions and commit the lockfile. Verify connector API and IAM/database-role setup against current docs before implementing.
- Local PostgreSQL integration tests may use an isolated PostgreSQL service; they must not point at operational Firebase data. Docker is optional tooling, not an app dependency.
- In app/UI, install SDK-compatible `expo-crypto` for secure UUIDs and `@react-native-async-storage/async-storage` for a durable one-command journal via `npx expo install`. Do not store credentials there. Lock writes to the journal within this single JS process; refuse a new command while an old one is unresolved.
- Server configuration: project/Cloud SQL instance connection name, database, database identity, STORE_TIMEZONE, host, port, and optional TLS/proxy settings. Require explicit IANA timezone; no implicit UTC/service-region assumption. Document a sample such as Asia/Manila as an example, not a confirmed value.
- Mobile configuration: existing Firebase variables plus EXPO_PUBLIC_LOCATION_COMMAND_URL. This is a public HTTPS URL, never a SQL password or service-account key. Local development uses a reachable LAN URL, not phone localhost; document Android HTTP restrictions without disabling transport security globally.
- End-user authentication remains out of scope, but do not publicly deploy unauthenticated inventory writes without explicit approval. Develop with loopback/restricted LAN or isolated disposable infrastructure. The service's database credentials still need proper IAM/database access and must stay server-side.

## 3. Small additive database migration

Keep current tables/column mappings and both enums. Add:

1. Stock.version integer NOT NULL DEFAULT 0.
2. Slot.version integer NOT NULL DEFAULT 0.
3. Operation ledger: operation ID primary key, canonical command JSON/payload, outcome (committed/conflict), result JSON, and server completion timestamp. Keep indefinitely for this prototype so old IDs never become new commands.
4. Optional Activity.operationID unique reference for audit linkage, plus from/to slot snapshots if included in this implementation. If added, allow null for historical rows; never rewrite old events as new ones.
5. CHECK slot ID 1–8 and matching nullability of productID/assignedAt. Review old data before enforcing constraints. Preserve the existing unique assignment and foreign keys.

Declare schema-managed additions in schema.gql using existing SQL column names; review Data Connect SQL diff. Apply any SQL-only constraints separately in compatible mode. Back up/test first; no table resets or enum replacements. Inspect existing bad fixtures (for example, PENDING_DISPATCH without an assignment); resolve explicitly rather than silently repairing them in app commands.

## 4. Button-to-database mapping

All rows below execute as one transaction and use server time. Version increments, command result persistence, and activity insertion are part of the same transaction.

| UI action / command | Stock write | Slot write | Activity |
|---|---|---|---|
| Select empty slot / PlaceProduct | EMPTY → OCCUPIED; update statusUpdatedAt/version | Set target productID and assignedAt; increment slot version | ON_RACK |
| Take off rack / TakeOffRack | OCCUPIED → PENDING_DISPATCH; update time/version | Keep binding and original assignedAt; increment slot version | OFF_RACK |
| Select own reserved slot / ReturnProduct | PENDING_DISPATCH → OCCUPIED; update time/version | Keep binding/time; increment slot version | ON_RACK |
| Select another empty slot / MoveProduct | OCCUPIED or PENDING_DISPATCH → OCCUPIED; update time/version | Clear source productID AND assignedAt; bind target with server time; increment both versions | ON_RACK |
| Remove Product / DispatchProduct | PENDING_DISPATCH → EMPTY; update time/version | Clear source productID AND assignedAt; increment slot version | DISPATCHED |
| Expired scan / RecordExpiredScan | No changes, including version and statusUpdatedAt | No changes | REMOVED |

Placement adds one warehouse unit; dispatch removes one; take-off/return/move/expired rejection do not change warehouse total. Derive warehouse count from OCCUPIED + PENDING_DISPATCH. Never delete Stock records. OFF_RACK products retain bindings and their IDs remain visible on reserved slot buttons. Same-slot OCCUPIED selection is a no-op with no new event.

REMOVED means expired-scan rejection per the current schema, not physical disposal. Expired products cannot be placed/returned/moved/dispatched through normal actions. Log rejection once per deliberate scan; do not clear a stored expired product's assignment or deduct it. Actual disposal needs a separately agreed future action.

## 5. Command service and transactional algorithm

Provide:

- `POST /location/commands` accepting the existing Command shape from location/core.ts.
- `GET /location/operations/:operationID` returning the terminal stored outcome and canonical command, or a nonterminal/not-yet-found response. This endpoint never creates a new operation.
- A consistent location snapshot endpoint if needed by adapter.read; use a read-only REPEATABLE READ transaction for a multi-table snapshot. Otherwise direct connector reads are advisory and all preconditions are checked again on submission.

Each command implementation must:

1. Validate bounded JSON, action name, UUID, string ID, slot range, nonnegative versions, and exact required source/target shape. Do not accept arbitrary SQL, activity type, status, expiry verdict, or target project from the app.
2. Begin a PostgreSQL transaction. Insert operationID with canonical payload using conflict-safe insertion. Concurrent inserts of the same ID must serialize against the unique key. If a committed ledger entry exists, compare full payload and return its result; reject same ID/different payload. A committed result is immutable.
3. Lock the product row and affected slot rows in a documented consistent order. Read/lock its existing binding as needed. Verify observed product/slot versions, status/binding consistency, and target availability. Use checked/conditional updates as an additional safeguard. Every expected single-row update must affect exactly one row.
4. Recompute expiry from the stored Date and trusted request/server time in STORE_TIMEZONE. Valid through today. Missing expiry blocks expiry-sensitive actions. Unknown product is not a successful transition.
5. Apply the exact table mapping above. For moves, release source before target binding inside the transaction so the unique constraint is respected.
6. Insert the fixed ActivityType, using the same timestamp for the event and changed statusUpdatedAt. Record operation outcome and commit. A failed activity insert must roll back all stock/slot changes and the operation entry.
7. Persist expected business conflicts as terminal conflict outcomes with no inventory/history writes. SQL failures, timeouts, deadlocks, or serialization errors are not guessed conflicts. Roll back and retry transient DB errors internally with the same ID using a bounded retry policy, or return an uncertain/retryable response.
8. On transport loss, client reconciliation with the same ID determines whether commit happened. An absent ledger entry is not proof an in-flight command cannot still commit; keep the journal and retry/reconcile that same command. Distinguish mismatched-ID payload errors from a matching terminal outcome.

All queries use pg parameters, a bounded connection pool, and protected runtime credentials. Error responses do not leak SQL, passwords, or tokens. No client-side chain of independent stock/slot/activity mutations is acceptable.

## 6. Wire the existing LocationAdapter

Implement each method in location/adapter.ts:

- `read`: retrieve exact product and all eight slots with statuses, assignedAt, versions, and an advisory expiry verdict; validate with existing validateSnapshot. Absence is null only for a missing product. Refresh/retry transient inconsistent advisory reads; do not invent versions.
- `pending`: load and validate the journal across app restarts. Corrupt/failed storage blocks new writes, not an empty journal.
- `prepare`: generate UUID and persist the full immutable command before returning. Enforce one pending action; do not generate a fresh UUID per retry.
- `submit`: call the command service; accept committed/conflict only with matching operation ID/payload and a valid authoritative result. A timeout or malformed response remains unresolved.
- `resolve`: query the ledger and verify the command matches. Missing/nonterminal results return null, leaving the journal intact.
- `clear`: remove only the matching command after terminal verification. Never clear unresolved actions just because Scan again was pressed.

Persist the scan-session operation ID too when recording REMOVED, so a render/reload/retry does not accidentally log duplicate rejection events. A new deliberate scan session may create another event. Mount the configured adapter only after its read/write endpoints and migration are available; do not leave a hard-coded null in the completed implementation.

## 7. Make the UI genuinely usable

- Reuse LocationWorkflow/core.ts and existing tests rather than creating a parallel state machine. Preserve camera permission, Code 128 scanning, retries, and exact barcode identity.
- After a successful context read, show eight buttons in 4×2 layout. Green/null assignment is selectable; gray/bound shows product ID and On rack or Off rack—reserved. Missing/bad/stale data is disabled with retry, not automatically treated as empty.
- EMPTY + valid expiry: select green slot → explicit placement confirmation → submit → success and refresh.
- OCCUPIED: own slot is highlighted/no-op; another green slot offers move confirmation; Take off rack works. Full-width Remove Product explains why take-off is needed first.
- PENDING_DISPATCH: own slot offers return; other green slot offers move; full-width Remove Product asks explicit confirmation of departure outside the warehouse.
- Expired: show rejection, record REMOVED once, and keep placement/dispatch disabled. Missing expiry and unknown product fail closed without fabricated history.
- Busy state disables repeated submissions. Resume/restart reconciles pending command before allowing more writes. If unresolved, show Check result/Retry same action; do not allow Scan again to discard its journal.
- Refresh product/slots after success, conflict, and foreground return; clear old results when scanning a different product. Remove the fallback preview only once the real adapter works.

## 8. Tests and completion criteria

Backend/PostgreSQL integration tests must prove:

- Each command produces the exact stock/slot/activity mapping and stock-count effect.
- A failed activity insert rolls back assignment and stock changes.
- Two phones competing for one slot yield at most one successful placement.
- Move vs. dispatch and concurrent moves preserve one binding and correct history.
- Retry/simultaneous same-ID calls have one committed effect; changed payload with same ID is rejected.
- Lost response followed by resolve returns the original outcome; restart preserves the same pending command.
- Old dispatch after return and another take-off fails its version check.
- Expired scan writes only REMOVED and does not alter status, timestamps, versions, or assignments.
- Store-midnight boundary and wrong phone clock do not change server eligibility rules.

Run UI tests, typecheck, lint, backend tests/typecheck, and Android export. Add actual adapter/journal tests, not only pure transition tables. Test physical Android against the real configured service in an isolated test project. Verify each action with Firebase queries for Stock, Slot, Activity, and Operation before/after.

**Done means:** tap eligible slot → real binding and OCCUPIED + ON_RACK; take off → retained binding and PENDING_DISPATCH + OFF_RACK; return/move work; dispatch → EMPTY + DISPATCHED and both slot assignment fields cleared; retries cannot repeat effects. No disabled placeholder adapter. Keep enum values unchanged. Document database migration, server startup/deployment, phone URL, credentials setup, timezone, and the explicit app-only/no-rack limitation.

## 9. Approvals/configuration needed before live deployment

Confirm actual STORE_TIMEZONE and the permitted exposure of the unauthenticated command service. Configure database connectivity and project explicitly; do not assume Firebase CLI login supplies PostgreSQL runtime credentials. Local isolated implementation/testing can proceed with documented configuration, but no public deployment or destructive data migration is authorized by this plan.

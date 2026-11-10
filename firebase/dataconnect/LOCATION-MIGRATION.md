# MVP schema and cloud deployment status

## Local change only

The single-phone MVP removes `Stock.version`, `Slot.version`, and the
`LocationOperation` schema. Connector operations no longer read or write these
fields, accept version/operation-ID variables, or expose
`GetLocationOperation`. The SDK is regenerated from this simplified contract.
Original status/activity enums, timestamps, foreign keys, and unique product
assignment are retained.

A cloud SQL diff was attempted against `smart-warehouse-3171e`. It printed that the database matches the simplified schema exactly, but exited with an authentication/unexpected error. Deployment was also attempted and failed because the Firebase CLI credentials require reauthentication. No cloud deployment, migration, or cleanup is confirmed successful. Local tests use a fresh in-memory emulator database, not saved emulator data or the cloud database.

To finish from `firebase/`:

```sh
firebase login --reauth
firebase dataconnect:sql:diff --project smart-warehouse-3171e
firebase deploy --only dataconnect --project smart-warehouse-3171e
```

If the diff requests changes, review it before running `firebase dataconnect:sql:migrate --project smart-warehouse-3171e`. Do not reset stock, slot, or activity data.

## Authorized cleanup, not executed here

The user explicitly authorizes removing the ledger schema and its cloud data
for this MVP. The parent owns reviewing and executing that cleanup. If the
previous additions reached the target database, the intended obsolete objects
are:

- `public.stocks.version`
- `public.slots.version`
- `public.location_operations` (including the operation ledger data)

Do not assume those names or their presence without inspecting the real schema.
Removing source declarations alone does not prove these SQL objects were
removed; compatible schema validation may retain extra columns/tables.

Before the parent applies anything:

1. Confirm the intended project/service/connector/database and inventory data.
   Current config names are `smart-warehouse-3171e` / `smart-warehouse-service` /
   `example` / `smart-warehouse-database`, in `asia-southeast1`.
2. Back up the database and review dependencies/other writers. Coordinate client
   changes: the new connector API is incompatible with version/operation-ID
   callers and ledger reconciliation. UI/backend are outside this task's scope.
3. Review the actual SQL diff and validation mode. Limit intentional destructive
   changes to the obsolete version columns and ledger; preserve stock, slot,
   activity, enum, timestamp, and assignment-constraint data/schema.
4. Rehearse on an isolated copy, including the conditional mutations and
   rollback tests. Do not reset the operational database to match fixtures.
5. Have the parent coordinate connector deployment, any necessary SQL cleanup,
   and client rollout. Verify the resulting schema and generated API afterward.

No automatic cleanup SQL or deployment hook is included. Durable idempotency
and version/ABA protection are deliberately absent, not a migration TODO. See
`LOCATION-CONTRACT.md` for the single-phone retry and expiry limitations.

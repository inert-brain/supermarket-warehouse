# Occupancy migration handoff — not executed

This is a **local connector-only change** implementing `esp32/plan.md` and the
relaxed scan rules in `app/UI/location/mvp-scan-plan.md`.
No cloud SQL diff, migration, deployment, data reset, or resource cleanup was
performed for this change. Existing stock, activity, assignments, enums,
foreign keys, and the unique product-assignment index must be retained.

## Intended additive schema change

Add only nullable columns to `public.slots`:

- `is_occupied boolean` (`Slot.isOccupied`)
- `occupancy_updated_at timestamptz` (`Slot.occupancyUpdatedAt`)

No false/default values or backfill: existing rows must start Unknown until a
real report arrives. Keep `assigned_product_id` and `assigned_at` unchanged.
EMPTY + assigned + vacant/unknown is a valid awaiting-placement state, not a
reason to clear data. Do not initialize all eight sensors to vacant. The relaxed
scan rules need no additional schema migration: false/null occupancy permits
actions, and observation age is display/debugging only. Reassignment preserves
any existing EMPTY/OCCUPIED/PENDING_DISPATCH status, including temporary mismatch
with saved occupancy; subsequent unchanged sensor behavior reconciles it.

## Later coordinated rollout (owner action, not this task)

1. Confirm project, service, connector, database and backups. Current local
   configuration is `smart-warehouse-service` / `example` /
   `smart-warehouse-database` in `asia-southeast1`; the prior project reference
   is `smart-warehouse-3171e`. Verify before any cloud action.
2. Review the actual cloud SQL diff. Limit this milestone to the two additive
   nullable columns; do not bundle destructive version/ledger cleanup from
   older plans. Preserve operational inventory and history.
3. Coordinate app/firmware/dashboard callers. `PlaceProduct`, `MoveProduct`,
   `TakeOffRack`, `ReturnProduct` are removed. Phone assignment is not receipt;
   ESP32 sends only slot ID/occupancy; dashboard must accept EMPTY bindings and
   read both observation fields. Those clients are outside this implementation.
4. Rehearse compiler and disposable emulator tests from `LOCATION-CONTRACT.md`.
   Review PUBLIC access before any deployment: this is intentionally an
   unauthenticated isolated prototype, not production authorization.
5. If separately approved, apply reviewed additive migration and coordinated
   connector/client rollout. Source edits alone do not change Firebase.
6. Start real reports to establish observations; compare existing stock states
   with physical readings. Startup matching occupied states must not create
   duplicate receipts. Investigate inconsistent assignments instead of resetting.

Older deployment attempts/cleanup notes do not authorize deployment here.
No migration/deployment hook is included. No custom server, version protocol,
operation ledger, or expiry service is introduced.

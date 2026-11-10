# Location connector contract and safety blocker

These are local source definitions only; they have not been deployed. The
`example` connector's existing operations remain unchanged.

## Available reads

Both operations use `@auth(level: PUBLIC)`. Anyone able to call the connector
can inspect product and location data. This is suitable only for an explicitly
approved, isolated prototype; it is not an authorization boundary.

- `GetProductContext($productID: String!)`: returns `stock`, either null or
  `{ productID, description, expiresOn, currentStatus, statusUpdatedAt }`, and
  `slots`, an array of `{ slotId, productID, assignedAt }` matching the exact
  product ID. Slot lookup is not limited to 1–8, so unexpected bindings are
  visible. `productID` remains a string. `statusUpdatedAt` is not a proven
  concurrency token.
- `GetSlotMenu`: takes no variables and returns `slots`, an array of
  `{ slotId, productID, assignedAt, stock }` for existing slot IDs 1–8, where
  `stock` is null or `{ productID, currentStatus }`. Missing slot IDs are not
  synthesized; sort by `slotId` in the client. Validate both assignment fields,
  the joined product, and status; fail closed on inconsistencies.

Data Connect queries do not guarantee a consistent snapshot across fields.
These reads are advisory; neither justifies a subsequent unconditional write.

## Commands are blocked, not implemented

There is no callable `PlaceProduct`, `TakeOffRack`, `ReturnProduct`,
`MoveProduct`, `DispatchProduct`, or `RecordExpiredScan` operation in this
connector. Do not wire the UI to assume any of these names or a mutation input
contract exists. Existing schema and enum definitions are unchanged.

Before implementing commands, review an additive migration for stock and slot
versions and durable operation IDs/results, including safe initialization of
existing rows and reconciliation of inconsistent fixtures. Confirm the actual
store IANA timezone independently; the Data Connect service region is not a
store timezone. Trusted time must enforce valid-through-expiry-day semantics.

Official documentation describes `@transaction` rollback and `@check`, and
`_updateMany` with a `where` filter, but this work did not establish and test
the entire required compare-and-swap, affected-row checking, concurrent replay
and same-ID/different-payload behavior, or trusted store-date evaluation. In
particular, a preliminary query followed by an unconditional update does not
protect competing clients. Do not substitute it. If a deployable connector
cannot provide and demonstrate all guarantees, use a narrowly scoped trusted
server command endpoint backed by a database transaction instead.

Before enabling any command, run emulator tests for competing claims, stale
dispatch after return/re-removal, move versus dispatch, failed activity insert
rollback, duplicate operation IDs (same and different payloads), lost-response
retry, expiry-day boundaries in the confirmed timezone, and preservation of
inventory on expired-scan rejection. Review public access separately:
transactional consistency does not prevent anyone from invoking PUBLIC writes.

References: [mutation guide](https://firebase.google.com/docs/data-connect/mutations-guide),
[directives reference](https://firebase.google.com/docs/reference/data-connect/gql/directive).

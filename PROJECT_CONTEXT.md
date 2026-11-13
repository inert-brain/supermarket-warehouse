# Project Context — Read First

**Scope:** source-verified local implementation and configuration, not proof of what is currently deployed/flashed. Private client settings and live Firebase/hardware were not inspected in this audit. Known mismatches below are existing issues, not completed fixes.

## Working style: school-demo MVP, conserve tokens

- Build the requested working demo, not a production platform. Be concise; make targeted edits and run focused checks. Avoid repeated planning, broad searches, unnecessary agents, and lengthy explanations for small changes.
- Do not reintroduce a custom backend, versions, operation ledgers, durable retry journals, authentication UI, timezone services, or extra box/quantity models unless explicitly requested. These were tried and intentionally removed.
- Keep basic correctness: atomic inventory writes, matching assignments, no invented product identity, and no false claims that tests/deployment/hardware passed. Known demo limitations are acceptable; do not deliberately introduce data corruption.
- Read only relevant source files. Reuse existing packages and patterns. Ask questions only for genuine missing decisions; do not repeatedly reopen settled MVP policies.
- Do not read private settings through another tool when editor privacy blocks access. Preserve local credentials and user changes. Do not deploy/reset/delete cloud data without appropriate task scope.
- This file summarizes the current direction. Current code/schema plus the latest user requirement override older plans. Many `plan.md` files are historical; do not implement them blindly. Update this summary when behavior changes.

## Architecture and components

```text
Expo Android app ────────────────┐
ESP32-S3 rack ──────────────────┼→ Firebase Data Connect → Cloud SQL PostgreSQL
Streamlit dashboard (reads only)┘
ESP32-S3 → UART → Arduino UNO slot LEDs
```

No computer-hosted command server is needed. `app/backend` has been deleted. Local SQLite `data/warehouse.db` has been removed; `data/schema.sql` and Dockerfile are legacy, not the operational database. Expo Go still needs the development server; a bundled installed build does not.

| Area | Key source |
|---|---|
| Phone | `app/UI/App.tsx`, `receiving.ts`, `receiving-core.ts` |
| Phone actions | `app/UI/location/core.ts`, `LocationWorkflow.tsx`, `service.ts`, `firebase-command.ts`, `firebase-snapshot.ts`, `firebase-transport.ts` |
| Cloud | `firebase/dataconnect/schema/schema.gql`, `example/queries.gql`, `example/mutations.gql` |
| Rack | `esp32/esp32.ino` — single pasteable ESP32-S3 sketch, editable settings at top |
| UNO | `arduino/arduino.ino`, `arduino/README.md` |
| Wiring | `esp32/component_connections.md` |
| Dashboard | `dashboard/app.py`, `firebase_client.py`, `metrics.py`, `sync_state.py` |

Read `app/UI/AGENTS.md` before changing Expo APIs. Packages currently include Expo 58, React Native 0.88, TypeScript, expo-camera, and Firebase JS SDK. Use Node 24.12+ on the Node 24 line for the current lockfile (`@firebase/app` declares >=24.12.0); the UI README's older Node minimum is stale. Dashboard requires Python 3.11+ and pinned Streamlit, Requests, and pandas.

## Current cloud target — old docs may name the previous project

- Project: **mart-parking-fdd6b** (`firebase/.firebaserc`).
- Service: **smart-supermarket-service**.
- Region: **asia-southeast1**; connector: **example**.
- Cloud SQL instance/database: **smart-supermarket-instance / smart-supermarket-database**.
- Definition: `firebase/dataconnect/dataconnect.yaml`. Phone target: `app/UI/receiving.ts`.
- **Active configuration mismatch:** `dashboard/app.py`, `dashboard/firebase_client.py`, and its README still default to `smart-warehouse-3171e` / `smart-warehouse-service`. Explicitly set the current `project` and `service` in dashboard settings; supplying only key/app ID is insufficient. Streamlit secrets override environment values per field. Private overrides were not inspected.
- Emulator scripts also retain old database/service targets, and `example/generated/` retains the old service config. These are not merely historical prose. The phone uses its own `receiving.ts` initialization, not that generated SDK.
- Phone configuration: `app/UI/.env.local` → EXPO_PUBLIC_FIREBASE_API_KEY, EXPO_PUBLIC_FIREBASE_PROJECT_ID, EXPO_PUBLIC_FIREBASE_APP_ID.
- Dashboard: `dashboard/.streamlit/secrets.toml` `[firebase]` → api_key, app_id, project, region, service, connector; environment alternatives in its README.
- Rack: RACK_WIFI_*, RACK_FIREBASE_*, RACK_PROJECT/REGION/SERVICE/CONNECTOR and RACK_ROOT_CA at the top of the sketch. Do not copy credentials into this document.

## Data model and settled behavior

Active API/client identifier: `containerID` (formerly `productID`). SQL mappings remain
`product_id` / `assigned_product_id`; constraints, operation names, and barcode values
are unchanged. Deploy the renamed Data Connect contract and update app, dashboard,
and ESP32 together; old clients expect the old field. Source edits do not deploy Firebase.

One containerID is one physical unit; preserve barcode text exactly, including leading zeros. The UI requires eight existing slot rows, IDs 1–8; schema deployment does not create them. Provision missing rows explicitly with unreported occupancy null. The unique relationship limits a product to one slot. Do not add a box/product distinction.

- **Stock:** containerID, currentStatus, statusUpdatedAt, description, expiresOn.
- **Slot:** slotId, nullable containerID/assignedAt, nullable isOccupied/occupancyUpdatedAt.
- **Activity:** activityId, containerID, occurredAt, activityType.
- StockStatus: EMPTY, OCCUPIED, PENDING_DISPATCH.
- ActivityType: ON_RACK, OFF_RACK, DISPATCHED, REMOVED.

Physical occupancy and assignment are separate. The Hall sensor detects an object/magnet, not its identity. Staff must place the assigned product correctly.

| Action | Stock / activity | Slot |
|---|---|---|
| Register unknown barcode | New EMPTY; no activity | No binding |
| Assign/change slot | Preserve status; no receipt/activity | Bind target; moving clears old containerID AND assignedAt |
| Sensor detects assigned EMPTY product | OCCUPIED + ON_RACK | Save occupied; keep binding |
| Sensor loses OCCUPIED product | PENDING_DISPATCH + OFF_RACK | Save vacant; keep binding/reservation |
| Sensor detects pending product again | OCCUPIED + ON_RACK | Keep original binding/assignedAt |
| Confirm external dispatch | EMPTY + DISPATCHED | Clear containerID AND assignedAt; preserve sensor fields |
| Successful expired-scan logging | REMOVED activity only | No inventory/binding change |

Repeated sensor reports refresh observation time but should not duplicate transitions/events. Warehouse stock = count OCCUPIED + PENDING_DISPATCH; rack stock = count OCCUPIED. Assignment alone is not receipt. EMPTY can mean unreceived or dispatched; do not equate all EMPTY rows with dispatches.

### Phone scan rules — deliberately relaxed MVP

After container lookup, an empty description requires a second product barcode scan. The app writes the exact scanned barcode directly to `stocks.description` through `SaveContainerProduct`, without a Firestore lookup or automatic read-back. Existing descriptions are retained unless staff select Scan product. Deploy the mutation before using the flow.

- Read product by barcode. Explicit not-found → RegisterScannedProduct, then reread. Existing records stay unchanged. New records have null description/expiry.
- **Phone-side policy:** valid expiry OR no expiry can continue. Expiry popups, confirmation warnings, and expiry detail text are hidden in the app; expired products are blocked for normal assignment/dispatch. After a valid inventory snapshot, the app attempts one REMOVED log per deliberate scan; failures/uncertain responses are not automatically retried. Use the phone's local calendar date; valid through the expiry day. No GPS or separate store timezone setting.
- Assigned slot with isOccupied=true → show **Already in Slot X / On rack**, no picker/location action.
- Otherwise show 4×2 slot picker. Unassigned false/null occupancy → green/selectable. Known occupied or assigned to another product → unavailable. Own slot is a no-op.
- **Current UI/cloud discrepancy:** the UI enables initial assignment for an unbound nonexpired product regardless of stock status, but AssignProductToSlot in the cloud accepts only EMPTY. Unbound OCCUPIED/PENDING_DISPATCH fixtures can therefore show a choice and then be rejected; do not describe that case as working end to end.
- No 30-second report/freshness requirement. Saved occupancy can be old. Null is allowed for assignment **and confirmed dispatch** in this demo.
- Dispatch requires an assigned product, not-expired expiry, and isOccupied not true. Do NOT require PENDING_DISPATCH: saved product status can lag. Explicit confirmation still required. Warehouse-count effect is zero for prior EMPTY, minus one for prior OCCUPIED/PENDING_DISPATCH.
- Block repeat taps during an action, refresh afterward, and do not blindly retry ambiguous writes. No exactly-once/restart-recovery guarantee. App polls the open inventory screen about every 5 seconds; dashboard does not.

### Cloud operations

- RegisterScannedProduct(containerID): insert-on-conflict-do-nothing; EMPTY/null details defaults, never overwrite existing stock.
- ReportSlotOccupancy(slotID, occupied): firmware supplies no container ID; cloud resolves binding and atomically synchronizes observation, status, and activity.
- AssignProductToSlot(containerID, targetSlotID): initial binding; cloud currently requires EMPTY/unassigned product.
- ChangeAssignedSlot(containerID, sourceSlotID, targetSlotID): source/target not known occupied, matching source and free target; preserve stock/history.
- DispatchProduct(containerID, sourceSlotID): bound not-known-occupied source, any existing stock status; atomically empty/unbind/log.
- RecordExpiredScan(containerID, sourceSlotID nullable): rejection log only; checks binding consistency, not expiry. Without a source, cloud requires EMPTY and no bindings. Thus an unbound non-EMPTY product may pass client command construction but fail this mutation.
- Reads: GetStockByProductID, GetLocationSnapshot, GetSlotMenu, GetProductContext, GetSlotBindings; DashboardStocks/Slots/Activities use key pagination.

Operations use direct SDK calls or REST predefined-operation endpoints. Mutations use transactions and parameterized SQL/conditional checks. Do not replace these with independent client writes. **Cloud does not enforce expiry:** PUBLIC callers can bypass phone eligibility and call RecordExpiredScan for nonexpired products. REMOVED is caller-reported rejection, not verified expiry/disposal. Sensor reconciliation also ignores expiry. Connector operations are PUBLIC for the controlled demo, not production-secure. API keys are public client config, not authorization. No SQL passwords/Admin credentials in phone or firmware.

## Hardware essentials

- ESP32-S3 Hall GPIOs by slot: **4, 5, 6, 7, 15, 16, 17, 18**. INPUT_PULLUP, normally LOW=detected/occupied, HIGH=not detected. Polarity configurable at sketch top.
- Sample ~20 ms; debounce ~300 ms. Startup waits for a stable baseline and usable cloud configuration/Wi-Fi/TLS clock. Reports become due on changes/reconnect and ~5 seconds after a slot's completed attempt, with a 1-second per-slot minimum retry interval. Requests are sequential: these are targets, not guaranteed latency. Network worker must not block sampling. Report booleans only, never auto-dispatch.
- Serial Monitor **115200**; diagnostic heartbeat/raw snapshot every 2 seconds, raw edges controlled by RACK_VERBOSE_SYNC. Firebase SEND is an attempt; OK validates the mutation response, not independent read-back. Native USB may need USB CDC On Boot enabled. Current checked-in sketch has empty Wi-Fi SSID and CA, so it is not cloud-ready until edited; an empty Wi-Fi password is allowed. Missing required settings disable cloud, not sensor logs.
- Verified TLS needs trusted PEM root(s), Wi-Fi, and NTP clock setup. This clock setup is not expiry logic. **ArduinoJson 7 and hd44780 are required to compile the current sketch**, even without LCD hardware; ESP32 core supplies the other libraries. LCD hardware initialization failure is tolerated.
- UNO drives D2–D9 LEDs; ESP32 sends `L:01200000\n` at 9600 baud via GPIO13→UNO D11. 0=off, 1=on, 2=blink. **UNO replies now report applied LED modes and boot/watchdog state.** UNO D12→ESP32 GPIO14 needs the documented 5 V→3.3 V divider. ESP32 prints diagnostics every two seconds and reports missing replies after three seconds; it continues operating independently. Physical LED health is not sensed. USB cables alone are not this UART protocol.
- UNO LEDs: on=vacant/unassigned; off=occupied/awaiting first placement/unknown; blink=assigned product previously on-rack is now absent. Three-second command timeout turns LEDs off; buzzer inactive. Assignment metadata is RAM-cached from valid cloud responses, so assignment/dispatch changes reach LEDs after a response; cache can be stale offline and resets at reboot.
- Implemented optional 16×2 LCD browser: I2C GPIO8/9; buttons GPIO11 previous, GPIO12 mode, GPIO10 next. The middle button cycles local Status, cached Container ID, cached Stock status, and assigned time. It pages long IDs, and formats assignment time at fixed UTC+8 (display only, not expiry). Native LCD tests exist. Some older README/plan statements still call these peripherals out of scope; current sketch is authoritative.
- Verify real board settings, Hall polarity, and 3.3 V compatibility; some A3144 modules need different supply conditions. Never connect 5 V signals directly to S3 GPIO. Do not claim live hardware tests without performing them.

## Run, deploy, and validate

Commands below assume the named working directory; do not run Expo in dashboard/.

```sh
# app/UI/
npm ci
npx expo start --clear
npm test
npm run typecheck
npm run lint

# dashboard/ — use Python 3.11+ interpreter
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m streamlit run app.py
.venv/bin/python -m unittest discover

# firebase/ — review diff before migration; deploy changes explicitly
firebase dataconnect:sql:diff --project mart-parking-fdd6b
firebase dataconnect:sql:migrate --project mart-parking-fdd6b
firebase deploy --only dataconnect --project mart-parking-fdd6b

# repository root — native firmware logic tests
g++ -std=c++11 esp32/tests/rack_logic_test.cpp -o /tmp/rack_logic_test && /tmp/rack_logic_test
g++ -std=c++11 arduino/tests/output_test.cpp -o /tmp/rack_output_test && /tmp/rack_output_test
g++ -std=c++11 esp32/tests/lcd_logic_test.cpp -o /tmp/rack_lcd_test && /tmp/rack_lcd_test
```

Dashboard: manual **Sync only**, complete paginated reads, metrics/graphs/slot monitor/tables. Retain last complete snapshot on failure. Activities show event counts, not reconstructed historical stock balances. Only records read by Sync are displayed; no inventory edits.

Predictions tab is a labeled static demo: seven sample demand days plus a fixed
three-day forecast overlay for Milk (5/day), Cereal (3/day), or Juices (4/day).
It reads no live prediction data and changes no inventory.

Dashboard also has a **Shelves** tab with independent **Sync shelves**, reading
Firestore `(default)` / `products/SHELF_*` in `mart-parking-fdd6b` (override with
`FIRESTORE_PROJECT`). It displays saved shelf counters and fields, retains its last
snapshot on errors, and uses existing public Firestore read rules without admin
credentials. It does not write to Firestore or change warehouse stock logic.

Overview shows shelf alerts at the top using the shared shelf snapshot: SHELF_01
Milk, SHELF_02 Cereal, SHELF_03 Juices. `remaining <= 1` triggers a red alert (0 is
out of stock); `capacity` does not determine low stock. **Sync shelf alerts** and
**Sync shelves** refresh the same data; unknown counts are never treated as zero.

Slot monitor barcode buttons resolve the stock description against the `barcode`
field in Firestore `shoppingCartWorkspaces/shopping-cart/products`, with document-ID
fallback for saved Pxxx IDs. P003 was verified to have barcode DEMO003. Reads occur
only on click and display the matched product ID/name/fields; app barcode saving
remains a direct description write without a catalog lookup.

Deployment is separate from source edits; operation-not-found usually means missing deployment or mismatched project/service/connector. Expired CLI login: firebase login --reauth. Never reset tables as a deployment fix. Check actual cloud state rather than claiming it matches local files.

Known maintenance issues: Firebase emulator tests import `pg` from deleted `app/backend/node_modules/pg`, retain the old database/service names, and use stale generated SDK connector configuration. Supply an independent test dependency and align/regenerate targets before running them. Do not recreate the old backend service to satisfy the import. Some app/cloud READMEs still describe unknown expiry or null dispatch occupancy as blocked; current code permits them. Native firmware tests exclude Arduino/network code and do not validate physical timing/wiring. This audit ran no tests/deployments; historical results do not prove current source, deployed Firebase, or hardware behavior.

Product scanning pauses at **Prepare product**. Move the container label away and tap **Start product scan** to enable the camera for the second barcode. Repeat scans of the selected container are ignored.

LCD navigation logs `[LCD BUTTON]` events to the ESP32 Serial Monitor; GPIO11 is previous, GPIO12 cycles details, and GPIO10 is next. Cached stock status is refreshed from existing occupancy responses, with no extra cloud queries.

App expiry prompts are removed from scanning and staff confirmations. Stored expiry dates, expiry eligibility checks, and expired-scan logging remain in place; this change affects presentation only.

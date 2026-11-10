# ESP32-S3 + Hall Sensors → Firebase SQL Connect: Hardware Integration Plan

## 1. Scope and architecture

Implement the rack's eight Hall inputs, stable occupancy detection, and cloud synchronization when a product is lifted. Ignore the UNO, LEDs, buzzer, display, and buttons for this phase.

```text
Hall sensors → ESP32-S3 → Wi-Fi / HTTPS → Firebase Data Connect → PostgreSQL
Phone app ─────────────────────────────→ Firebase Data Connect
```

No laptop-hosted backend, Firestore, Realtime Database, local SQLite sync, or SQL credentials in firmware. A computer is needed only for building/flashing firmware and deploying connector changes. The ESP32 runs independently afterward.

Use the existing product/slot/activity tables and enums. Sensors report presence, not identity. Product identity always comes from the slot's assigned productID. The phone remains responsible for scanning and assigning the correct product.

## 2. Verified wiring from component_connections.md

The actual filename is `component_connections.md`, not `components_connections.md`.

| Slot | ESP32-S3 GPIO | Hall signal |
|---|---|---|
| 1 | 4 | S |
| 2 | 5 | S |
| 3 | 6 | S |
| 4 | 7 | S |
| 5 | 15 | S |
| 6 | 16 | S |
| 7 | 17 | S |
| 8 | 18 | S |

For every module: VCC → documented 3.3 V rail; GND → common GND; S → its GPIO. Configure INPUT_PULLUP.

The wiring document specifies HIGH with no magnet and LOW with a magnet. Therefore the proposed mechanical mapping is LOW = occupied and HIGH = vacant, provided a loaded platform brings the magnet near the sensor. Bench-check this for every slot before cloud testing; invert the mapping if the assembled mechanism behaves oppositely.

**Electrical check:** the documented KY-003/A3144 may not switch reliably at 3.3 V; the wiring file itself flags an approximately 4.5 V minimum for some parts. Verify the actual sensor/module. Prefer a verified 3.3 V-compatible sensor if necessary. Do not simply power a module at 5 V and connect a potentially 5 V signal to an ESP32 GPIO. Any alternative supply needs verified 3.3 V-safe signal conditioning. Confirm the exact ESP32-S3 board/pin availability and module pin order. Follow the wiring file's USB/external-power precautions.

## 3. Firmware setup

No existing firmware/build framework is present in this folder. Proposed MVP: Arduino IDE with the stable Espressif ESP32 board package and the exact ESP32-S3 board selected. Record the chosen board and installed versions when implementing.

Use:

- Arduino ESP32 core: GPIO, WiFi, WiFiClientSecure, HTTPClient, Preferences if persisting a small pending event.
- ArduinoJson for encoding/decoding connector requests and responses.
- Serial logging only for diagnostics; it must not be required at runtime.

No Firebase Firestore/RTDB Arduino library is needed: those libraries target different Firebase databases. Use Data Connect's predefined-operation REST API over HTTPS. Wi-Fi SSID/password and Firebase public configuration belong in an ignored firmware config header; commit a config example, not actual Wi-Fi credentials. Never flash a service-account private key or PostgreSQL password.

Use a trusted CA certificate or supported certificate bundle and normal TLS validation, not setInsecure(). If TLS certificate checks need a valid device clock, synchronize it by NTP after Wi-Fi connects. This is connection setup only: no GPS, location detection, timezone service, or expiry logic on the ESP32.

## 4. Sensor sampling

- Poll all eight inputs every approximately 20 ms using millis(); avoid a blocking delay for each input.
- Require a candidate reading to remain unchanged for about 300 ms before accepting it as stable. Make these constants configurable for bench tuning.
- Keep raw/candidate/stable occupancy independently for each slot.
- Stable occupied → vacant creates one removal task.
- Repeated vacant readings create no further tasks.
- Short magnet bounce does not create inventory events.
- Keep Wi-Fi/HTTPS outside the sampling loop. A dedicated FreeRTOS worker can process a small queue while loop() samples sensors. Use a queue/mutex rather than shared unsynchronized state.
- Keep a bounded pending task per slot, not an unlimited stream of raw readings. Refresh current physical/cloud state before sending delayed work.

### Minimal sampling code for the implementation

This is an architecture starter, not a complete flashable firmware. The cloud worker and config described below still need implementation.

```cpp
#include <Arduino.h>

constexpr uint8_t HALL_PINS[8] = {4, 5, 6, 7, 15, 16, 17, 18};
constexpr uint32_t SAMPLE_MS = 20;
constexpr uint32_t STABLE_MS = 300;

struct SlotInput {
  bool candidateOccupied;
  bool stableOccupied;
  bool initialized;
  bool baselineReady;
  uint32_t candidateSince;
};
SlotInput inputs[8]{};

// Queue a current-state reconciliation task; do not perform HTTPS here.
void queueSlotSync(uint8_t slotId, bool occupied);

void setupHallInputs() {
  for (uint8_t pin : HALL_PINS) pinMode(pin, INPUT_PULLUP);
}

void sampleHallInputs() {
  static uint32_t lastSample = 0;
  const uint32_t now = millis();
  if (uint32_t(now - lastSample) < SAMPLE_MS) return;
  lastSample = now;

  for (uint8_t i = 0; i < 8; ++i) {
    const bool occupied = digitalRead(HALL_PINS[i]) == LOW;
    SlotInput &s = inputs[i];
    if (!s.initialized || occupied != s.candidateOccupied) {
      s.candidateOccupied = occupied;
      s.candidateSince = now;
      s.initialized = true;
      continue;
    }
    if (uint32_t(now - s.candidateSince) < STABLE_MS) continue;
    // Initial stable readings reconcile with Firebase; they are not receipts.
    if (!s.baselineReady || occupied != s.stableOccupied) {
      s.baselineReady = true;
      s.stableOccupied = occupied;
      queueSlotSync(i + 1, occupied);
    }
  }
}
```

Every slot enqueues one startup reconciliation after its first stable reading, including initially vacant slots. The cloud worker interprets that as reconciliation, not a new receipt. Unsigned subtraction handles millis() rollover. A reconnect should also schedule reconciliation even if no new sensor edge occurs.

## 5. Direct cloud API and connector changes

Existing target configuration:

- Project: smart-warehouse-3171e
- Region: asia-southeast1
- Service: smart-warehouse-service
- Connector: example

REST base:

```text
https://firebasedataconnect.googleapis.com/v1/projects/smart-warehouse-3171e/locations/asia-southeast1/services/smart-warehouse-service/connectors/example
```

Read with POST to `:executeQuery?key=FIREBASE_WEB_API_KEY` and write with POST to `:executeMutation?key=FIREBASE_WEB_API_KEY`. Set Content-Type: application/json; use the same Firebase app ID in `x-firebase-gmpid` as the configured public client where applicable.

This public-client request pattern matches the installed Firebase JavaScript SDK: the API key is appended as `key`; no database credentials are used. Test the exact public REST call against the deployed connector before embedding it in firmware. API-key restrictions or future Auth/App Check requirements can block a bare ESP32 client and must be accounted for. An API key is not an authorization secret; current operations are deliberately PUBLIC for the prototype.

Add one narrow `GetRackSlot($slotID: Int!)` query returning the exact slot's slotId, productID, assignedAt and joined stock productID/currentStatus. Compile its actual generated key syntax before deploying. Reuse existing `TakeOffRack` and `ReturnProduct` mutations instead of making the ESP32 execute arbitrary GraphQL/SQL.

Example removal request body, after looking up the binding:

```json
{
  "operationName": "TakeOffRack",
  "variables": {
    "productID": "WH-PROD-005",
    "sourceSlotID": 1
  }
}
```

Read request:

```json
{
  "operationName": "GetRackSlot",
  "variables": { "slotID": 1 }
}
```

An HTTP 200 is not sufficient: parse JSON and reject a response containing GraphQL `errors`. Check the expected data fields as well. Use finite connect/read timeouts, reconnect backoff, and useful serial messages without logging Wi-Fi secrets.

### HTTPS request helper shape

```cpp
// Implementation outline; all values come from the ignored config header.
// ArduinoJson API details must match the installed version.
bool executeConnector(const char *method, const String &json,
                      String &responseBody) {
  WiFiClientSecure tls;
  tls.setCACert(DATA_CONNECT_ROOT_CA);
  HTTPClient http;
  const String url = String(DATA_CONNECT_BASE) + ":" + method
                   + "?key=" + FIREBASE_WEB_API_KEY;
  if (!http.begin(tls, url)) return false;
  http.setConnectTimeout(5000);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-firebase-gmpid", FIREBASE_APP_ID);
  const int status = http.POST(json);
  responseBody = status > 0 ? http.getString() : String();
  http.end();
  // Caller must parse responseBody and validate GraphQL data/errors.
  return status >= 200 && status < 300;
}
```

## 6. Removal: exact synchronization logic

`syncSlot(slotID)` runs in the network worker:

1. Confirm the input is still stably vacant before doing removal work.
2. Query the current slot binding from Firebase. Never infer product identity from the magnet.
3. If no product is assigned, log "vacant/unassigned" and do not write stock/activity.
4. If the assigned product is OCCUPIED, capture its productID and assignedAt; call TakeOffRack with that product and slot.
5. Existing transaction updates Stock OCCUPIED → PENDING_DISPATCH, updates statusUpdatedAt, checks the matching slot binding, and inserts exactly one OFF_RACK activity. Slot.productID and assignedAt remain populated. Warehouse inventory does not decrease.
6. If already PENDING_DISPATCH with the same binding, acknowledge/reconcile; do not write another activity. An EMPTY product with a retained binding is inconsistent: stop and report it, not an automatic repair.
7. Refresh Firebase after response failure/timeout. If it now shows the captured binding as PENDING_DISPATCH, treat the removal as synchronized. Otherwise retry only while that same binding remains and the physical sensor is still vacant.
8. If the assignment changes, stop replaying that old task. Do not apply a saved removal to a different product or newly assigned slot.

Existing status predicates prevent a duplicate TakeOffRack from creating a second OFF_RACK once status is PENDING_DISPATCH. This is simple state-based retry handling, not durable event-ID/exactly-once protection. Do not reintroduce version/ledger tables for this MVP.

### Optional narrow mutation guard

The lookup and current TakeOffRack call are separate requests. For a modest additional guard without new tables, consider adding an optional/required `expectedAssignedAt` argument to a hardware-specific removal operation, comparing it with the existing slot assignment timestamp and productID in the transaction. Update all relevant callers if changing the shared operation signature. This guards stale bindings, not every possible repeated removal cycle. Keep it optional scope for the first single-rack test, not a reason to block basic integration.

## 7. Return and restart handling

Removal-only synchronization would leave a returned box pending forever. Include this small reconciliation rule using existing data:

- Stable occupied + same assigned product PENDING_DISPATCH → call ReturnProduct; it sets OCCUPIED and logs ON_RACK without adding inventory or changing the binding.
- Stable occupied + assigned product OCCUPIED → no write.
- Stable occupied + no assignment → log "occupied, unidentified"; do not invent a product or receipt.
- A physical return is an observation, not a new expiry/receiving decision. The ESP32 does not evaluate expiry; it restores the reserved product's on-rack state. The phone still blocks new expired receiving.

At startup, establish a stable baseline and read cloud slot states. Never count an occupied startup slot as a new receipt. Reconcile vacant/OCCUPIED as a pending removal and occupied/PENDING_DISPATCH as a return only under the prototype assumption that the existing binding still identifies that slot's object. Offline replacement by a different object cannot be detected by Hall sensors; expose that limitation and require staff correction, not invented identity.

If a return happens before queued removal is sent, reconcile to current state instead of uploading stale vacancy. If removal already committed, send the matching return. While offline, keep pending work bounded (one current reconciliation per slot), resume after Wi-Fi recovers, and always reread cloud binding before retry. Small NVS persistence is optional; startup reconciliation is sufficient for the initial controlled demo. Do not write NVS every sensor sample.

## 8. Phone coordination and MVP limits

- Once hardware removal is enabled, remove/hide the normal manual Take off rack button or label it clearly as a test-only override; the sensor should drive that state transition.
- Phone scan/slot assignment remains as currently implemented in this phase. Do not also count sensor placement as a second receipt.
- On scan, foreground return, Refresh, and before dispatch confirmation, refresh Firebase so PENDING_DISPATCH reported by the rack is visible. A lightweight refresh interval while the result screen is open may improve the demo; no permanent background polling is needed.
- Dispatch is still explicit phone confirmation. It sets EMPTY, clears both slot assignment fields, and logs DISPATCHED. ESP32 never dispatches automatically.
- ReturnProduct from the sensor invalidates pending status, so normal dispatch is rejected if the return was synchronized first.
- This remains a best-effort prototype handshake: without a stored occupancy/pending-event identity, the current schema cannot prove that the item is still physically absent at confirmation or prevent every delayed-cycle race. Offline ESP32/phone communication is not a full double-check. Do not claim that guarantee. No new occupancy schema is required for this initial removal demo; propose it separately if stronger verification is requested.
- Firmware must not decide expiry, write REMOVED, clear assignments on temporary removal, or delete products.

## 9. Implementation order and test checklist

1. Confirm exact board/module reliability and polarity; read GPIOs over serial with Wi-Fi disabled. Do not test cloud logic until all eight sensor readings are correct.
2. Implement independent debounce/baseline logic and test simultaneous changes and short bumps.
3. Deploy the narrow slot query and verify direct HTTPS calls against an isolated Firebase fixture using the actual public client configuration.
4. Implement network worker, state reconciliation, finite timeouts/backoff, and response parsing; first integrate one slot, then all eight.
5. Coordinate phone action visibility/refresh and verify an end-to-end rack removal followed by phone-confirmed dispatch.

Expected tests:

| Test | Expected Firebase result |
|---|---|
| Bound OCCUPIED product lifted for >300 ms | PENDING_DISPATCH + one OFF_RACK; binding retained |
| Repeated vacant readings | No additional changes/history |
| Magnet bump shorter than stability interval | No transition |
| Two slots lifted | Correct per-slot products updated independently |
| Empty unassigned slot | No inventory writes |
| Returned before dispatch | OCCUPIED + ON_RACK; same binding/assignedAt |
| Phone confirms dispatch after removal | EMPTY + DISPATCHED; both assignment fields null |
| ESP32 restart while product remains stored | No new receipt/ON_RACK event |
| Wi-Fi drops before request | Sample continues; retry/reconcile after reconnect |
| Response lost after cloud commit | Refresh sees PENDING_DISPATCH; no second OFF_RACK |
| Binding changes while offline | Old task discarded; do not remove new product |
| Object placed in unassigned slot | Unidentified warning, no fabricated receipt |

Inspect stocks.current_status/status_updated_at, slots.assigned_product_id/assigned_at, and activities.activity_type/occurred_at after each step through Firebase queries. Capture startup/raw/stable/cloud logs. Compile for the actual S3 board and report hardware tests separately from emulator tests.

## 10. Deliverables and decisions

Planned files: ESP32 sketch or PlatformIO equivalent, ignored config header plus example, testable debounce/reconciliation modules, README flashing/setup steps, and the narrow Firebase query. This document contains starter code only; no firmware or cloud change is implemented by writing the plan.

Before selecting final firmware settings, confirm the exact ESP32-S3 board and whether the fitted Hall modules switch reliably at the documented 3.3 V. Confirm a loaded platform really produces LOW. These are hardware facts, not reasons to add unrelated UI, auth, or timezone scope.

Reference: https://firebase.google.com/docs/reference/data-connect/rest/v1/projects.locations.services.connectors/executeMutation . The installed Firebase JavaScript SDK was also inspected for its public-client REST endpoint, API-key query parameter, and app-ID header. Real hardware and deployed REST access remain to be tested.

# Eight-slot occupancy reporter

Single-file Arduino ESP32-S3 firmware implementing the ESP32 portion of `plan.md`.
The rack reports physical occupancy directly to Firebase Data Connect; the cloud
resolves assignments, product status, and activities. Firmware does not query
products, choose product transitions, receive, dispatch, clear bindings, or decide
expiry. No laptop service, Firebase Arduino library, UNO, LCD, LEDs, or buttons are
required. This firmware change does not deploy the cloud or update the phone/dashboard.

## No serial logs on ESP32-S3?

The sketch prints `[ALIVE]` and all eight raw Hall readings every two seconds, even without working Wi-Fi/Firebase settings. With USB CDC enabled, logs also mirror to UART0.

- Native USB port: select the correct S3 board and enable **Tools → USB CDC On Boot → Enabled** if that setting is available, then upload again. Keep the board's supported USB mode selected.
- USB-to-UART port: select its serial port and use **115200 baud**. Some S3 boards have separate USB and UART connectors; the selected port must match the connected one.
- After upload, reselect the serial port if it changes, open Serial Monitor, and press RESET/EN once.
- If no `[ALIVE]` appears, check the board/port/upload/USB settings and data-capable cable first. Firebase cannot suppress the heartbeat.

## Wiring and board

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| GPIO | 4 | 5 | 6 | 7 | 15 | 16 | 17 | 18 |

Inputs use `INPUT_PULLUP`: **LOW = occupied**, HIGH = vacant. Set
`RACK_OCCUPIED_WHEN_LOW = false` only if bench testing confirms inverted output.
See `component_connections.md` for power, pin order, and USB/external-power precautions;
its additional peripherals are not used by this sketch.

**ESP32-S3 is the target.** Verify the actual board's exposed pins, flash/PSRAM,
and upload/USB settings before flashing. Bench-test every Hall module at 3.3 V;
some KY-003/A3144 modules are unreliable at that voltage. Never connect a 5 V
signal directly to an S3 GPIO. Avoid simultaneous external 5 V and USB power
unless the board supports it safely.

## Setup

1. Install Espressif's **esp32** board package and **ArduinoJson 7**. WiFi,
   WiFiClientSecure, HTTPClient, and FreeRTOS come with the ESP32 core.
2. Open `esp32.ino`, or copy its complete contents into one Arduino sketch tab.
   Edit settings at the top: `RACK_WIFI_SSID`, `RACK_WIFI_PASSWORD`,
   `RACK_FIREBASE_API_KEY`, `RACK_FIREBASE_APP_ID`, `RACK_PROJECT`, `RACK_REGION`,
   `RACK_SERVICE`, and `RACK_CONNECTOR`. Preserve your existing local values.
   Never use service-account/SQL credentials or private signing keys. Keep real
   Wi-Fi credentials out of Git and shared sketch copies. An existing ignored
   `config.h` is not read; do not delete it or overwrite credentials unnecessarily.
3. Set `RACK_ROOT_CA` to trusted root PEM(s) from the official Google Trust
   Services repository, <https://pki.goog/repository/>. Verify the current
   `firebasedataconnect.googleapis.com` chain, root fingerprints, and validity;
   use roots, not a short-lived leaf. Multiple concatenated PEMs are supported.
   Preserve an existing correct CA and maintain it as chains rotate. Example
   workstation check:
   ```sh
   openssl s_client -connect firebasedataconnect.googleapis.com:443 \
     -servername firebasedataconnect.googleapis.com \
     -CAfile roots.pem -verify_hostname firebasedataconnect.googleapis.com \
     -verify_return_error </dev/null
   ```
   Firmware uses `setCACert`, hostname verification, finite network timeouts,
   no redirects, and no insecure fallback.
4. Default timing: `RACK_SAMPLE_MS = 20`, `RACK_STABLE_MS = 300`, `kPollMs = 5000`
   (per-slot heartbeat after the last completed attempt), `kReconnectMs = 10000`
   (Wi-Fi retry), and `kMinimumCycleMs = 1000` (per-slot edge/failure retry floor).
   `kMinimumTime` is only a TLS clock sanity threshold, not expiry logic.
5. Select the actual S3 board/settings, upload, and open Serial Monitor at
   **115200**. Empty required settings/PEM disable cloud work, not Hall sampling.
   Wi-Fi must reach HTTPS and NTP (`time.google.com` / `pool.ntp.org`). HTTPS
   waits for a plausible UTC clock. No timezone/expiry service is used.
6. The deployed connector must provide `ReportSlotOccupancy`, permit this
   prototype's public REST calls, and allow this API key/app configuration.
   Auth/App Check requirements would need additional firmware. This task does
   not deploy anything or prove which connector version is live.

Compile from the repository root with installed dependencies:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32s3 esp32
```

This generic **ESP32-S3 Dev Module** target is a smoke build, not confirmation of
the physical board settings. A standalone check can compile a copy containing
only `esp32.ino` inside a directory named `esp32`; no project headers are required.

## Reporting and safety boundary

- `loop()` samples independently of networking, with 300 ms debounce per slot.
  Startup is unknown until the first stable reading. Even a bounce back to the
  old stable value must settle again before reporting.
- A FreeRTOS worker performs all Wi-Fi/HTTPS work. Sensor mutexes only protect
  short copies/updates, never network waits. Serial logs show raw edges, stable
  states, the slot/boolean sent, request outcomes, and returned cloud metadata.
  `RACK_VERBOSE_SYNC` controls raw-edge/request diagnostics; stable/outcome logs
  remain available. Known configured credentials are redacted from response logs.
- All eight slots report their first stable value, subsequent stable changes,
  unchanged heartbeats about every five seconds, and current stable values on
  Wi-Fi reconnect. Unassigned slots report too; no product lookup is required.
- Scheduling retains eight sensor states and eight small report receipts, not
  an offline edge/event queue. Notifications only wake the worker. Offline
  intermediate movements are intentionally discarded. Each attempt builds a
  fresh request from the latest settled sensor copy.
- Due slots are visited round-robin, so failures/noise in one slot do not block
  the others indefinitely. A generation check after the TLS handshake cancels
  stale work before transmission. If occupancy changes during POST, only the
  sent generation is acknowledged; the newest settled reading remains due for
  the next attempt, subject to the retry floor and other due slots.
- Requests are sequential. Five seconds is a target, not a guarantee for eight
  slow HTTPS requests. Measure all eight observation ages against the plan's
  initial 30-second freshness threshold before relying on it for a demo.
- A lost response may already have committed. The next report sends current
  occupancy again, never a product event. **Cloud idempotency is required:**
  every accepted report refreshes the server observation timestamp, but repeated
  same-state reports must not duplicate product transitions or activities.

Presence cannot identify a product: staff must put the scanned item in its
assigned slot. No exactly-once delivery or atomic physical dispatch interlock is
claimed. PUBLIC operations are not an authorization boundary; use an isolated,
controlled school prototype.

## REST request and response contract

POST directly to:

```text
https://firebasedataconnect.googleapis.com/v1/projects/<project>/locations/<region>/services/<service>/connectors/<connector>:executeMutation?key=<public-api-key>
```

Headers: `Content-Type: application/json`, `x-firebase-gmpid: <app-id>`.
The request has exactly these operation variables (example):

```json
{
  "operationName": "ReportSlotOccupancy",
  "variables": { "slotID": 1, "occupied": true }
}
```

No product ID, activity type, timestamp, or next status is sent. There are no
query/read-back requests or alternative product mutations.

Response assumptions:

- Acceptance requires HTTP 2xx, valid JSON, an object `data`, no API `error`,
  and absent/empty GraphQL `errors`. Partial data with errors is a failure.
- Requires `data.observation = 1` and `data.query.slot` with matching slotId/isOccupied and an occupancyUpdatedAt string, as returned by the current connector. Deploy that connector before flashing this sketch.
- Prints `DB UPDATED: slot N isOccupied=false (OFF RACK); confirmed by Firebase response.` or the corresponding true/ON RACK line only after those checks pass. This confirms the mutation response, not a separate read-back.
- Logs the returned assigned product, stock status, and timestamp. No activity ID is required for a heartbeat/no-op. Missing/mismatched response fields or HTTP/GraphQL errors trigger a later report of the latest sensor state.
- Detected means true/on-rack; not detected means false/off-rack. Unknown/null is an app-side demo fallback before a successful report; firmware always sends a boolean. Dispatch remains phone-confirmed.

The coordinated cloud must implement the transition/no-op rules in `plan.md`.
The phone assigns vacant slots and explicitly confirms dispatch; physical placement,
lift, and return are interpreted by the cloud from occupancy reports. Refresh the
phone and use dashboard Sync as appropriate; firmware does not update UI directly.

## Validation

Native tests include the **same sketch**, excluding Arduino-specific code:

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic \
  esp32/tests/rack_logic_test.cpp -o /tmp/rack_logic_test && /tmp/rack_logic_test
```

Coverage: stable startup for both readings, repeated heartbeats, bounce/unsettled
suppression, generation guards across TLS waits, changes during slow requests,
failed/lost-response retries using latest state, all eight pins/independent slots,
reconnect without offline replay, and `millis()` wraparound. These tests do not
validate HTTP/JSON parsing, FreeRTOS timing, server transactions, or activity
idempotency. Those require a board/isolated cloud integration test.

Before the demo, check every sensor's polarity/voltage, startup without duplicate
receipts, first placement, lift/return with retained assignment, unassigned
occupancy, unchanged heartbeat timestamps without new events, simultaneous slots,
slow requests, Wi-Fi loss/reconnect, and a lost response. No live endpoint,
certificate-chain, physical-board, or end-to-end validation is claimed here.

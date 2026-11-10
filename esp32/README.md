# Eight-slot rack MVP

Arduino ESP32-S3 firmware; no UNO, LCD, LEDs, buttons, Firebase deployment, or UI changes.
`plan.md` describes the intended behavior; this implementation deliberately reuses
**GetSlotMenu**, not the plan's proposed new GetRackSlot query.

## Wiring and board

| Slot | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| GPIO | 4 | 5 | 6 | 7 | 15 | 16 | 17 | 18 |

All inputs use `INPUT_PULLUP`: **LOW = occupied**, HIGH = vacant. See
`component_connections.md` for power, pin order, and USB/external-power precautions.
**ESP32-S3 is the confirmed target.** The exact board/module variant is still
unknown: verify its exposed pins, flash/PSRAM size, and upload/USB settings rather
than assuming generic defaults are correct.
Bench-test every Hall module at 3.3 V; some KY-003/A3144 modules are unreliable at
that voltage. Never connect a 5 V signal directly to an S3 GPIO.

## Setup

1. Install Espressif's **esp32** Arduino board package and **ArduinoJson 7** via
   Boards/Library Manager. WiFi, WiFiClientSecure, HTTPClient, and FreeRTOS come
   with the ESP32 core; no Firebase Arduino library is needed.
2. Open **`esp32.ino`** or paste its entire contents into a single Arduino sketch
   tab. It is self-contained: no project headers or extra sketch tabs are needed.
   Edit the `constexpr` settings at the top: `RACK_WIFI_SSID`, `RACK_WIFI_PASSWORD`,
   `RACK_FIREBASE_API_KEY`, and `RACK_FIREBASE_APP_ID`, using the intended isolated
   Firebase client configuration. Check `RACK_PROJECT`, `RACK_REGION`, `RACK_SERVICE`,
   and `RACK_CONNECTOR`. Never use service-account keys, SQL credentials, or private
   signing keys. Keep real Wi-Fi credentials out of Git and shared sketch copies.
   An existing local `config.h` is no longer read; manually transfer its values
   into the sketch. It remains ignored by Git and does not need to be deleted.
3. Set `RACK_ROOT_CA` to an actual trusted root PEM (multiple concatenated PEMs
   are supported). Obtain Google Trust Services roots from the official HTTPS
   repository, <https://pki.goog/repository/>. Check the current
   `firebasedataconnect.googleapis.com` chain and the root's fingerprint/validity
   against that repository. Use the issuing root(s), **not a short-lived leaf**.
   Replace the empty `RACK_ROOT_CA` string at the top of the sketch using the
   raw-string syntax illustrated there. Check a downloaded CA file from your
   workstation, for example:
   ```sh
   openssl s_client -connect firebasedataconnect.googleapis.com:443 \
     -servername firebasedataconnect.googleapis.com \
     -CAfile roots.pem -verify_hostname firebasedataconnect.googleapis.com \
     -verify_return_error </dev/null
   ```
   Keep the trust roots maintained as chains rotate. Firmware uses `setCACert`,
   normal hostname verification, finite timeouts, and no insecure fallback.
4. Adjust timing in the same top settings block if needed: `RACK_SAMPLE_MS`
   (20 ms), `RACK_STABLE_MS` (300 ms), `kPollMs` (5000 ms), `kReconnectMs`
   (10000 ms), and `kMinimumCycleMs` (1000 ms). `kMinimumTime` is the TLS clock
   sanity threshold (Unix seconds), not inventory expiry logic.
   Select the actual S3 board and its settings, build/upload, and open Serial
   Monitor at **115200**. There is no wait for Serial at startup. With empty
   required settings/PEM, it still compiles and samples Hall inputs, but prints
   an explicit configuration diagnostic and disables cloud work.
5. Wi-Fi must reach HTTPS and NTP (`time.google.com` / `pool.ntp.org`). Firmware
   waits for a plausible UTC clock before TLS. No timezone/expiry logic is used.
   Confirm the deployed connector permits the public predefined-operation REST
   calls and API-key/app restrictions permit this client. Future Auth/App Check
   requirements would need additional implementation. No cloud credentials or
   inventory data are bundled here; no live requests were made during validation.

Optional CLI build, once dependencies and the CLI are installed:

```sh
arduino-cli compile --fqbn esp32:esp32:esp32s3 esp32
```

Run from the repository root. This FQBN selects the generic **ESP32-S3 Dev Module**,
not the original ESP32 or another ESP32 family. It is a compile smoke target;
record the actual S3 board/settings before flashing.

## Behavior and safety boundary

- `loop()` samples every 20 ms with independent 300 ms debounce. Both intervals
  are configurable. Even a bounce **back to the old stable value** must settle
  again before any mutation. Stable GPIO diagnostics work without Wi-Fi.
- A FreeRTOS worker does all Wi-Fi/HTTP work. Short mutex-protected sensor copies
  keep network waits out of sampling. Notifications are coalesced; there is no
  unbounded event queue, saved product identity, NVS journal, or POST retry queue.
- Reconcile at boot, on Wi-Fi reconnect, after accepted sensor changes, and about
  five seconds after each completed cycle. Change-triggered cycles are limited
  to at most one per second. Wi-Fi reconnect attempts are spaced ten seconds apart.
- POST `GetSlotMenu` to `:executeQuery` for discovery, then **reread it immediately
  before each proposed mutation**. Validate all eight unique slot IDs, binding
  timestamps, joined product identity/status, and duplicate product bindings.
  Invalid/partial cloud data blocks writes. HTTP success alone is insufficient:
  JSON, GraphQL errors, and expected mutation result fields are checked.
- The pre-read sensor generation is checked again **after TLS connects inside
  HTTPClient's POST**, just before request transmission. Any observed candidate
  change (even one that returns to the same value) cancels that work. Sensor
  mutexes are never held across a network call.
- Only bound **OCCUPIED + settled vacant → TakeOffRack** and bound
  **PENDING_DISPATCH + settled occupied → ReturnProduct** are sent, with only
  `productID` and `sourceSlotID` variables. Unassigned/no-op states never write;
  occupied/unassigned logs an unidentified-object warning. Startup is a baseline,
  not a receipt. Firmware never dispatches, receives, clears bindings, or decides expiry.
- Any timeout, rejection, invalid reply, or canceled generation stops that cycle.
  Next cycle starts with fresh cloud reads; there is **no blind mutation retry**.
  A lost response after commit normally resolves to a no-op on the next read.

**Prototype limitations:** presence cannot identify a replacement object; staff
must ensure the existing binding actually identifies the object. Offline intermediate
movements are not reconstructed. Generation checks cannot prevent a physical
change after the final check or while a request is in flight. Existing server
transactions recheck product/status/source binding, but do not compare an expected
`assignedAt`: same-product unbind/rebind races and repeated status cycles remain
possible. This is best-effort state reconciliation, not exactly-once delivery or
an atomic hardware/cloud/phone dispatch interlock. PUBLIC connector operations
are not an authorization boundary; use an isolated, controlled prototype.

## Using it with the phone

Seed all eight slots and deploy the existing `GetSlotMenu`, `TakeOffRack`, and `ReturnProduct` operations before testing. No additional connector query or schema change is needed. Assign the correct product to a slot using the phone, with the real object already resting on its sensor; the current app treats assignment as completed placement, so a still-vacant assigned slot will correctly be reconciled as off-rack. A future receiving handshake can separate reservation from actual placement.

Lift the product: the firmware writes PENDING_DISPATCH/OFF_RACK while keeping its binding. Return it: the firmware restores OCCUPIED/ON_RACK. Refresh the phone to see the result; confirm external dispatch only in the phone. Avoid using the app's manual Take off rack action as the normal hardware trigger, since a sensor that still reports occupied will reconcile that manual change back to on-rack. After setup/flashing, no laptop process is required.

## Validation

Native tests, from the repository root (no Arduino dependencies):

```sh
g++ -std=c++11 -Wall -Wextra -Werror -pedantic \
  esp32/tests/rack_logic_test.cpp -o /tmp/rack_logic_test && /tmp/rack_logic_test
```

Tests cover startup, the full decision table, unsettled candidates/bounce-back,
repeated readings, generation changes during network gaps, lost-response state
reconciliation, simultaneous slots, pin mapping, and `millis()` wraparound.
The tests define `RACK_LOGIC_TEST` and include `../esp32.ino` directly, excluding
only Arduino-specific code. There is no separate helper implementation to drift
from the firmware. They do not test live HTTP/server transactions or FreeRTOS timing.

For a single-file build check, copy only `esp32.ino` into a new directory named
`esp32` outside the project and compile that directory with the same FQBN and
installed dependencies. No `config.h` or `rack_logic.h` should be present. Empty
settings are intentional: cloud configuration is checked at runtime, so the full
cloud path still compiles without real credentials.

Still required on hardware/isolated cloud: all eight polarity/voltage checks,
startup/no duplicate receipt, removal/return and retained binding/history, short
bumps and return during a slow read/handshake, two simultaneous removals, Wi-Fi
loss while sampling, a lost mutation response, and a phone binding/dispatch change.
No deployed REST, certificate-chain, physical-board, or end-to-end test is claimed.

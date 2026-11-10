// Target: ESP32-S3 with the Espressif Arduino core and ArduinoJson 7.
// Generic compile target: esp32:esp32:esp32s3; verify board-specific pins/USB/flash before upload.
#include <stddef.h>
#include <stdint.h>
#include <time.h>

// EDIT SETTINGS HERE. This sketch needs no project headers or config.h.
// Keep real Wi-Fi credentials out of Git and shared copies of this file.
constexpr char RACK_WIFI_SSID[] = "";
constexpr char RACK_WIFI_PASSWORD[] = "";  // Empty is allowed for an open test network.
constexpr char RACK_FIREBASE_API_KEY[] = "";  // Public web API key, never a service-account key.
constexpr char RACK_FIREBASE_APP_ID[] = "";   // Same app ID as the phone's Firebase app.
constexpr char RACK_PROJECT[] = "smart-warehouse-3171e";
constexpr char RACK_REGION[] = "asia-southeast1";
constexpr char RACK_SERVICE[] = "smart-warehouse-service";
constexpr char RACK_CONNECTOR[] = "example";

// REQUIRED: paste actual trusted root PEM(s) from https://pki.goog/repository/.
// Verify the endpoint chain; use roots, not a short-lived server/leaf cert.
// Replace "" with a raw string containing the actual PEM(s), for example:
// R"PEM(-----BEGIN CERTIFICATE-----
// ... actual base64 certificate from the trusted source ...
// -----END CERTIFICATE-----
// )PEM";
constexpr char RACK_ROOT_CA[] = "";

constexpr uint32_t RACK_SAMPLE_MS = 20u;
constexpr uint32_t RACK_STABLE_MS = 300u;
constexpr char kHost[] = "firebasedataconnect.googleapis.com";
constexpr uint32_t kPollMs = 5000;
constexpr uint32_t kReconnectMs = 10000;
constexpr uint32_t kMinimumCycleMs = 1000;
constexpr time_t kMinimumTime = 1735689600;  // 2025-01-01, TLS sanity only.
// END EDITABLE SETTINGS.

static_assert(RACK_SAMPLE_MS > 0 && RACK_STABLE_MS >= RACK_SAMPLE_MS,
              "Debounce interval must be at least one sample interval");

// Pure sensor/reconciliation logic is shared with native tests of this file.
namespace rack {
constexpr size_t kSlotCount = 8;
constexpr uint8_t kHallPins[kSlotCount] = {4, 5, 6, 7, 15, 16, 17, 18};

struct Sensor {
  bool rawOccupied = false;
  bool candidateOccupied = false;
  bool stableOccupied = false;
  bool initialized = false;
  bool baselineReady = false;
  uint32_t candidateSince = 0;
  uint32_t generation = 0;
};

// Return true only when accepting a baseline or a new stable state.
inline bool sample(Sensor &s, bool occupied, uint32_t now, uint32_t stableMs) {
  s.rawOccupied = occupied;
  if (!s.initialized || occupied != s.candidateOccupied) {
    s.initialized = true;
    s.candidateOccupied = occupied;
    s.candidateSince = now;
    ++s.generation;
  }
  if (uint32_t(now - s.candidateSince) >= stableMs &&
      (!s.baselineReady || s.stableOccupied != s.candidateOccupied)) {
    s.stableOccupied = s.candidateOccupied;
    s.baselineReady = true;
    ++s.generation;
    return true;
  }
  return false;
}

inline bool settled(const Sensor &s, uint32_t now, uint32_t stableMs) {
  // Even a bounce back to the old stable value needs a full quiet interval.
  return s.baselineReady && s.rawOccupied == s.candidateOccupied &&
         s.candidateOccupied == s.stableOccupied &&
         uint32_t(now - s.candidateSince) >= stableMs;
}

enum class CloudStatus { Unassigned, Occupied, PendingDispatch, Invalid };
enum class Action { None, TakeOffRack, ReturnProduct };

inline Action decide(const Sensor &s, CloudStatus cloud, uint32_t now,
                     uint32_t stableMs) {
  if (!settled(s, now, stableMs)) return Action::None;
  if (cloud == CloudStatus::Occupied && !s.stableOccupied)
    return Action::TakeOffRack;
  if (cloud == CloudStatus::PendingDispatch && s.stableOccupied)
    return Action::ReturnProduct;
  return Action::None;
}

inline bool mayMutate(const Sensor &beforeRead, const Sensor &current,
                      uint32_t now, uint32_t stableMs) {
  return beforeRead.generation == current.generation &&
         beforeRead.stableOccupied == current.stableOccupied &&
         settled(beforeRead, now, stableMs) && settled(current, now, stableMs);
}
}  // namespace rack

#ifndef RACK_LOGIC_TEST
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <freertos/task.h>

rack::Sensor sensors[rack::kSlotCount];
SemaphoreHandle_t sensorMutex = nullptr;
TaskHandle_t cloudTask = nullptr;

rack::Sensor sensorSnapshot(size_t index) {
  xSemaphoreTake(sensorMutex, portMAX_DELAY);
  const rack::Sensor result = sensors[index];
  xSemaphoreGive(sensorMutex);
  return result;
}

bool configurationReady() {

  const String ca = RACK_ROOT_CA;
  const bool ready = strlen(RACK_WIFI_SSID) && strlen(RACK_FIREBASE_API_KEY) &&
                     strlen(RACK_FIREBASE_APP_ID) && strlen(RACK_PROJECT) &&
                     strlen(RACK_REGION) && strlen(RACK_SERVICE) &&
                     strlen(RACK_CONNECTOR) &&
                     ca.indexOf("-----BEGIN CERTIFICATE-----") >= 0 &&
                     ca.indexOf("-----END CERTIFICATE-----") >= 0;
  if (!ready)
    Serial.println("CONFIG: set Wi-Fi, Firebase public config and a trusted PEM CA at the top of esp32.ino; no cloud requests.");
  return ready;
}

// HTTPClient connects inside POST. Guard after TLS, not merely before POST,
// including any reconnect, without holding the sensor mutex during network I/O.
class SnapshotTLSClient : public WiFiClientSecure {
 public:
  SnapshotTLSClient(int index, const rack::Sensor *expected)
      : index_(index), expected_(expected) {}
  using WiFiClientSecure::connect;
  int connect(const char *host, uint16_t port, int32_t timeout) override {
    const int result = WiFiClientSecure::connect(host, port, timeout);
    if (result && expected_ &&
        !rack::mayMutate(*expected_, sensorSnapshot(index_), millis(), RACK_STABLE_MS)) {
      Serial.println("SYNC: sensor changed/unsettled during read or TLS; mutation discarded.");
      stop();
      return 0;
    }
    return result;
  }

 private:
  int index_;
  const rack::Sensor *expected_;
};

bool connectorRequest(bool mutation, const JsonDocument &request,
                      JsonDocument &response, int slotIndex = -1,
                      const rack::Sensor *expected = nullptr) {
  if (WiFi.status() != WL_CONNECTED || time(nullptr) < kMinimumTime ||
      (mutation && (!expected || slotIndex < 0 || slotIndex >= int(rack::kSlotCount))))
    return false;
  String body;
  if (request.overflowed() || !serializeJson(request, body)) return false;
  const String url = String("https://") + kHost + "/v1/projects/" + RACK_PROJECT +
      "/locations/" + RACK_REGION + "/services/" + RACK_SERVICE + "/connectors/" +
      RACK_CONNECTOR + (mutation ? ":executeMutation?key=" : ":executeQuery?key=") +
      RACK_FIREBASE_API_KEY;

  SnapshotTLSClient tls(slotIndex, mutation ? expected : nullptr);
  tls.setCACert(RACK_ROOT_CA);
  tls.setHandshakeTimeout(5);  // Seconds; TCP and HTTP timeouts below are ms.
  HTTPClient http;
  if (!http.begin(tls, url)) return false;
  http.setConnectTimeout(5000);
  http.setTimeout(8000);
  http.setReuse(false);
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-firebase-gmpid", RACK_FIREBASE_APP_ID);


  const int status = http.POST(body);
  String payload = status >= 200 && status < 300 ? http.getString() : String();
  http.end();
  tls.stop();
  if (status < 200 || status >= 300) {
    Serial.printf("HTTPS: request failed (%d); fresh read next cycle, no blind retry.\n", status);
    return false;
  }
  const DeserializationError error = deserializeJson(response, payload);
  if (error || response.overflowed() || !response["errors"].isNull() ||
      !response["data"].is<JsonObject>()) {
    Serial.println("HTTPS: invalid data/GraphQL errors; fresh read next cycle.");
    return false;
  }
  return true;
}

rack::CloudStatus slotStatus(JsonObjectConst slot) {
  const JsonVariantConst product = slot["productID"];
  const JsonVariantConst assigned = slot["assignedAt"];
  const JsonVariantConst stock = slot["stock"];
  if (product.isNull() && assigned.isNull() && stock.isNull())
    return rack::CloudStatus::Unassigned;
  if (!product.is<const char *>() || !strlen(product.as<const char *>()) ||
      !assigned.is<const char *>() || !strlen(assigned.as<const char *>()) ||
      !stock.is<JsonObjectConst>() || !stock["productID"].is<const char *>() ||
      strcmp(product.as<const char *>(), stock["productID"].as<const char *>()) != 0)
    return rack::CloudStatus::Invalid;
  const char *status = stock["currentStatus"] | "";
  if (!strcmp(status, "OCCUPIED")) return rack::CloudStatus::Occupied;
  if (!strcmp(status, "PENDING_DISPATCH")) return rack::CloudStatus::PendingDispatch;
  return rack::CloudStatus::Invalid;  // Includes EMPTY with a retained binding.
}

JsonObjectConst findSlot(const JsonDocument &menu, size_t index) {
  for (JsonObjectConst slot : menu["data"]["slots"].as<JsonArrayConst>())
    if (slot["slotId"].as<int>() == int(index + 1)) return slot;
  return JsonObjectConst();
}

bool readMenu(JsonDocument &menu) {
  JsonDocument request;
  request["operationName"] = "GetSlotMenu";
  request["variables"].to<JsonObject>();
  if (!connectorRequest(false, request, menu)) return false;
  const JsonArrayConst slots = menu["data"]["slots"].as<JsonArrayConst>();
  bool seen[rack::kSlotCount] = {};
  if (slots.isNull() || slots.size() != rack::kSlotCount) {
    Serial.println("CLOUD: expected all eight slots; no writes.");
    return false;
  }
  for (JsonObjectConst slot : slots) {
    const int id = slot["slotId"] | 0;
    if (!slot["slotId"].is<int>() || id < 1 || id > int(rack::kSlotCount) ||
        seen[id - 1] || slotStatus(slot) == rack::CloudStatus::Invalid) {
      Serial.println("CLOUD: invalid/duplicate slot, binding or stock status; no writes.");
      return false;
    }
    seen[id - 1] = true;
    // Fail closed on inconsistent duplicate product assignments too.
    for (JsonObjectConst other : slots) {
      if (other["slotId"].as<int>() != id && !slot["productID"].isNull() &&
          slot["productID"].as<String>() == other["productID"].as<String>()) {
        Serial.println("CLOUD: duplicate product binding; no writes.");
        return false;
      }
    }
  }
  return true;
}

bool syncSlot(size_t index) {
  const rack::Sensor before = sensorSnapshot(index);
  if (!rack::settled(before, millis(), RACK_STABLE_MS)) return true;
  JsonDocument fresh;
  if (!readMenu(fresh)) return false;
  const JsonObjectConst slot = findSlot(fresh, index);
  const rack::Action action = rack::decide(before, slotStatus(slot), millis(), RACK_STABLE_MS);
  if (action == rack::Action::None) return true;

  const char *operation = action == rack::Action::TakeOffRack ? "TakeOffRack" : "ReturnProduct";
  JsonDocument request, response;
  request["operationName"] = operation;
  request["variables"]["productID"] = slot["productID"].as<const char *>();
  request["variables"]["sourceSlotID"] = index + 1;
  if (!connectorRequest(true, request, response, int(index), &before)) return false;
  const JsonObjectConst data = response["data"].as<JsonObjectConst>();
  if (!data["stock_updateMany"].is<int>() || data["stock_updateMany"].as<int>() != 1 ||
      !data["source"].is<int>() || data["source"].as<int>() != 1 ||
      !data["activity_insert"]["activityId"].is<int>()) {
    Serial.println("SYNC: unexpected mutation result; fresh read next cycle.");
    return false;
  }
  Serial.printf("SYNC: slot %u %s accepted.\n", unsigned(index + 1), operation);
  return true;
}

void reconcile() {
  JsonDocument menu;
  if (!readMenu(menu)) return;
  for (size_t i = 0; i < rack::kSlotCount; ++i) {
    const rack::Sensor sensor = sensorSnapshot(i);
    const rack::CloudStatus status = slotStatus(findSlot(menu, i));
    if (!rack::settled(sensor, millis(), RACK_STABLE_MS)) continue;
    if (status == rack::CloudStatus::Unassigned && sensor.stableOccupied)
      Serial.printf("SYNC: slot %u occupied, unidentified; no write.\n", unsigned(i + 1));
    if (rack::decide(sensor, status, millis(), RACK_STABLE_MS) != rack::Action::None &&
        !syncSlot(i)) return;  // Stop this cycle on uncertainty; never replay a POST.
  }
}

void cloudWorker(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  uint32_t lastReconnect = millis() - kReconnectMs;
  uint32_t lastCycle = 0, lastClockLog = millis() - kReconnectMs;
  bool connected = false, ranCycle = false, dirty = true;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (connected) Serial.println("Wi-Fi lost; sampling continues.");
      connected = false;
      ranCycle = false;
      if (uint32_t(millis() - lastReconnect) >= kReconnectMs) {
        lastReconnect = millis();
        Serial.println("Wi-Fi: connecting/reconnecting...");
        WiFi.begin(RACK_WIFI_SSID, RACK_WIFI_PASSWORD);
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    if (!connected) {
      connected = true;
      dirty = true;
      Serial.println("Wi-Fi connected; syncing UTC clock for verified TLS.");
      configTime(0, 0, "time.google.com", "pool.ntp.org");
    }
    if (time(nullptr) < kMinimumTime) {
      if (uint32_t(millis() - lastClockLog) >= kReconnectMs) {
        lastClockLog = millis();
        Serial.println("CLOCK: waiting for NTP; no HTTPS until clock is plausible.");
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    dirty = (ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100)) > 0) || dirty;
    const uint32_t elapsed = millis() - lastCycle;
    if (!ranCycle || ((dirty || elapsed >= kPollMs) && elapsed >= kMinimumCycleMs)) {
      dirty = false;
      reconcile();
      lastCycle = millis();
      ranCycle = true;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("Rack MVP: LOW=occupied, startup reconciliation only; never receipt/dispatch.");
  for (uint8_t pin : rack::kHallPins) pinMode(pin, INPUT_PULLUP);
  sensorMutex = xSemaphoreCreateMutex();
  if (!sensorMutex) {
    Serial.println("FATAL: sensor mutex allocation failed; cloud disabled.");
    return;
  }
  if (!configurationReady()) return;
  if (xTaskCreate(cloudWorker, "rack-cloud", 12288, nullptr, 1, &cloudTask) != pdPASS) {
    cloudTask = nullptr;
    Serial.println("ERROR: cloud task allocation failed; Hall diagnostics only.");
  }
}

void loop() {
  static uint32_t lastSample = millis() - RACK_SAMPLE_MS;
  const uint32_t now = millis();
  if (sensorMutex && uint32_t(now - lastSample) >= RACK_SAMPLE_MS) {
    lastSample = now;
    for (size_t i = 0; i < rack::kSlotCount; ++i) {
      const bool occupied = digitalRead(rack::kHallPins[i]) == LOW;
      xSemaphoreTake(sensorMutex, portMAX_DELAY);
      const bool changed = rack::sample(sensors[i], occupied, now, RACK_STABLE_MS);
      xSemaphoreGive(sensorMutex);
      if (changed) {
        Serial.printf("HALL: slot %u GPIO %u stable %s.\n", unsigned(i + 1),
                      rack::kHallPins[i], occupied ? "occupied" : "vacant");
        if (cloudTask) xTaskNotifyGive(cloudTask);
      }
    }
  }
  delay(1);  // Yield to FreeRTOS, never wait for Wi-Fi/HTTP in this loop.
}
#endif  // RACK_LOGIC_TEST

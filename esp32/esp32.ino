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
constexpr bool RACK_OCCUPIED_WHEN_LOW = true;  // Change only if bench testing shows inverted sensor output.
constexpr bool RACK_VERBOSE_SYNC = true;      // Prints raw edges and occupancy request diagnostics.
constexpr char kHost[] = "firebasedataconnect.googleapis.com";
constexpr uint32_t kPollMs = 5000;
constexpr uint32_t kReconnectMs = 10000;
constexpr uint32_t kMinimumCycleMs = 1000;
constexpr time_t kMinimumTime = 1735689600;  // 2025-01-01, TLS sanity only.
// END EDITABLE SETTINGS.

static_assert(RACK_SAMPLE_MS > 0 && RACK_STABLE_MS >= RACK_SAMPLE_MS,
              "Debounce interval must be at least one sample interval");

// Pure sensor/report scheduling logic is shared with native tests of this file.
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

inline bool mayReport(const Sensor &before, const Sensor &current,
                      uint32_t now, uint32_t stableMs) {
  return before.generation == current.generation &&
         before.stableOccupied == current.stableOccupied &&
         settled(before, now, stableMs) && settled(current, now, stableMs);
}

// Worker-owned receipts, not queued observations. Always send a fresh Sensor copy.
struct ReportSchedule {
  bool attempted = false;
  bool accepted = false;
  uint32_t acceptedGeneration = 0;
  uint32_t lastAttempt = 0;
};

inline bool reportDue(const Sensor &s, const ReportSchedule &report, uint32_t now) {
  if (!settled(s, now, RACK_STABLE_MS)) return false;
  if (!report.attempted) return true;
  const uint32_t elapsed = now - report.lastAttempt;
  return elapsed >= kMinimumCycleMs &&
         (!report.accepted || s.generation != report.acceptedGeneration || elapsed >= kPollMs);
}

inline void finishReport(ReportSchedule &report, const Sensor &sent,
                         bool accepted, uint32_t now) {
  report.attempted = true;
  report.accepted = accepted;
  report.lastAttempt = now;
  if (accepted) report.acceptedGeneration = sent.generation;
}

inline void resetReports(ReportSchedule (&reports)[kSlotCount]) {
  for (auto &report : reports) report = ReportSchedule{};
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

// ESP32-S3 native USB needs USB CDC On Boot enabled. Mirror to UART0 too.
class RackLogger : public Print {
 public:
  using Print::write;
  size_t write(uint8_t value) override { return write(&value, 1); }
  size_t write(const uint8_t *buffer, size_t size) override {
    if (Serial) Serial.write(buffer, size);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
    Serial0.write(buffer, size);
#endif
    return size;
  }
};
RackLogger rackLog;

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
    rackLog.println("CONFIG: set Wi-Fi, Firebase public config and a trusted PEM CA at the top of esp32.ino; no cloud requests.");
  return ready;
}

// HTTPClient connects inside POST. Recheck after TLS without holding a sensor
// mutex during network I/O. Changes after transmission are reported next time.
class SnapshotTLSClient : public WiFiClientSecure {
 public:
  SnapshotTLSClient(size_t index, const rack::Sensor &expected)
      : index_(index), expected_(expected) {}
  using WiFiClientSecure::connect;
  int connect(const char *host, uint16_t port, int32_t timeout) override {
    const int result = WiFiClientSecure::connect(host, port, timeout);
    if (result &&
        !rack::mayReport(expected_, sensorSnapshot(index_), millis(), RACK_STABLE_MS)) {
      rackLog.printf("DB: slot %u changed/unsettled during TLS; stale report cancelled.\n",
                    unsigned(index_ + 1));
      stop();
      return 0;
    }
    return result;
  }

 private:
  size_t index_;
  const rack::Sensor &expected_;
};

String redacted(String message) {
  for (const char *secret : {RACK_WIFI_SSID, RACK_WIFI_PASSWORD,
                             RACK_FIREBASE_API_KEY, RACK_FIREBASE_APP_ID})
    if (strlen(secret)) message.replace(secret, "[redacted]");
  return message;
}

bool connectorRequest(const JsonDocument &request, JsonDocument &response,
                      size_t slotIndex, const rack::Sensor &expected) {
  if (WiFi.status() != WL_CONNECTED || time(nullptr) < kMinimumTime ||
      !rack::mayReport(expected, sensorSnapshot(slotIndex), millis(), RACK_STABLE_MS))
    return false;
  String body;
  if (request.overflowed() || !serializeJson(request, body)) return false;
  const String url = String("https://") + kHost + "/v1/projects/" + RACK_PROJECT +
      "/locations/" + RACK_REGION + "/services/" + RACK_SERVICE + "/connectors/" +
      RACK_CONNECTOR + ":executeMutation?key=" + RACK_FIREBASE_API_KEY;

  SnapshotTLSClient tls(slotIndex, expected);
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
  String payload = status > 0 ? http.getString() : String();
  http.end();
  tls.stop();
  const char *operation = request["operationName"] | "unknown";
  const DeserializationError error = deserializeJson(response, payload);
  if (status < 200 || status >= 300) {
    rackLog.printf("DB: %s HTTP %d FAILED; update not confirmed.\n", operation, status);
    if (status < 0)
      rackLog.println(HTTPClient::errorToString(status));
    if (!error && response["error"]["message"].is<const char *>())
      rackLog.println(redacted(response["error"]["message"].as<String>()).substring(0, 300));
    return false;
  }
  if (error || response.overflowed()) {
    rackLog.printf("DB: %s invalid JSON (%s); update not confirmed.\n", operation, error.c_str());
    return false;
  }
  // An empty errors array is a successful GraphQL response, not an error.
  const JsonVariantConst errors = response["errors"];
  if (!errors.isNull() && (!errors.is<JsonArrayConst>() || errors.size() > 0)) {
    rackLog.printf("DB: %s GraphQL FAILED; transaction/update not confirmed.\n", operation);
    for (JsonObjectConst entry : errors.as<JsonArrayConst>()) {
      rackLog.println(redacted(entry["message"] | "Unspecified GraphQL error").substring(0, 300));
    }
    return false;
  }
  if (!response["error"].isNull()) {
    rackLog.println("DB: error envelope; occupancy report not confirmed.");
    rackLog.println(redacted(response["error"]["message"] | "Unspecified API error").substring(0, 300));
    return false;
  }
  if (!response["data"].is<JsonObjectConst>()) {
    rackLog.printf("DB: %s missing response data; update not confirmed.\n", operation);
    return false;
  }
  return true;
}

bool reportSlot(size_t index, const rack::Sensor &before) {
  if (RACK_VERBOSE_SYNC)
    rackLog.printf("CHECK: slot %u GPIO %u=%s raw=%s stable=%s settled=yes.\n",
                  unsigned(index + 1), rack::kHallPins[index],
                  before.rawOccupied == RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH",
                  before.rawOccupied ? "occupied" : "vacant",
                  before.stableOccupied ? "occupied" : "vacant");
  rackLog.printf("[FIREBASE SEND] %lu ms | Slot %u | %s | isOccupied=%s\n",
                static_cast<unsigned long>(millis()), unsigned(index + 1),
                before.stableOccupied ? "DETECTED / ON RACK" : "NOT DETECTED / OFF RACK",
                before.stableOccupied ? "true" : "false");
  JsonDocument request, response;
  request["operationName"] = "ReportSlotOccupancy";
  request["variables"]["slotID"] = int(index + 1);
  request["variables"]["occupied"] = before.stableOccupied;
  if (!connectorRequest(request, response, index, before)) {
    rackLog.printf("[FIREBASE FAIL] Slot %u | isOccupied=%s | update NOT CONFIRMED; will refresh latest sensor state.\n",
                  unsigned(index + 1), before.stableOccupied ? "true" : "false");
    return false;
  }
  // Confirm the deployed ReportSlotOccupancy operation saved this slot's reading.
  const JsonVariantConst observation = response["data"]["observation"];
  const JsonVariantConst slot = response["data"]["query"]["slot"];
  if (!observation.is<int>() || observation.as<int>() != 1 ||
      !slot.is<JsonObjectConst>() || !slot["slotId"].is<int>() ||
      slot["slotId"].as<int>() != int(index + 1) || !slot["isOccupied"].is<bool>() ||
      slot["isOccupied"].as<bool>() != before.stableOccupied ||
      !slot["occupancyUpdatedAt"].is<const char *>()) {
    rackLog.printf("[FIREBASE FAIL] Slot %u | response does not confirm the requested update.\n",
                  unsigned(index + 1));
    return false;
  }
  rackLog.printf("[FIREBASE OK] DB UPDATED: slot %u isOccupied=%s (%s); confirmed by Firebase response.\n",
                unsigned(index + 1), before.stableOccupied ? "true" : "false",
                before.stableOccupied ? "ON RACK" : "OFF RACK");
  if (!slot.isNull()) {
    const String interpretation = redacted(String("product=") + (slot["productID"] | "unassigned") +
        " status=" + (slot["stock"]["currentStatus"] | "unassigned/unknown") +
        " occupancyUpdatedAt=" + (slot["occupancyUpdatedAt"] | "not returned"));
    rackLog.printf("DB: slot %u cloud-reported %s\n", unsigned(index + 1), interpretation.c_str());
  }
  // No product lookup or dispatch request is made by the rack. The phone confirms departure.
  return true;
}

void cloudWorker(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  uint32_t lastReconnect = millis() - kReconnectMs;
  uint32_t lastClockLog = millis() - kReconnectMs;
  bool connected = false;
  rack::ReportSchedule reports[rack::kSlotCount];
  size_t nextSlot = 0;
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) {
      if (connected) rackLog.println("Wi-Fi lost; sampling continues.");
      connected = false;

      if (uint32_t(millis() - lastReconnect) >= kReconnectMs) {
        lastReconnect = millis();
        rackLog.println("Wi-Fi: connecting/reconnecting...");
        WiFi.begin(RACK_WIFI_SSID, RACK_WIFI_PASSWORD);
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    if (!connected) {
      connected = true;
      rack::resetReports(reports);
      rackLog.println("Wi-Fi connected; report all current stable slots after UTC clock sync for TLS.");
      configTime(0, 0, "time.google.com", "pool.ntp.org");
    }
    if (time(nullptr) < kMinimumTime) {
      if (uint32_t(millis() - lastClockLog) >= kReconnectMs) {
        lastClockLog = millis();
        rackLog.println("CLOCK: waiting for NTP; no HTTPS until clock is plausible.");
      }
      vTaskDelay(pdMS_TO_TICKS(100));
      continue;
    }
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(100));
    // Round-robin due slots so a failed/noisy slot cannot starve the other seven.
    for (size_t offset = 0; offset < rack::kSlotCount; ++offset) {
      const size_t index = (nextSlot + offset) % rack::kSlotCount;
      const rack::Sensor before = sensorSnapshot(index);
      if (!rack::reportDue(before, reports[index], millis())) continue;
      const bool accepted = reportSlot(index, before);
      rack::finishReport(reports[index], before, accepted, millis());
      nextSlot = (index + 1) % rack::kSlotCount;
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial0.begin(115200);
#endif
  rackLog.println("[BOOT] Rack S3 logging v2 — heartbeat every 2 seconds; monitor at 115200 baud.");
  rackLog.printf("Rack MVP: %s=occupied; report occupancy only; cloud resolves assignment/status/activity.\n",
                RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH");
  rackLog.println("Slot 3 Hall input is GPIO 6. Serial Monitor: 115200 baud.");
  for (uint8_t pin : rack::kHallPins) pinMode(pin, INPUT_PULLUP);
  sensorMutex = xSemaphoreCreateMutex();
  if (!sensorMutex) {
    rackLog.println("FATAL: sensor mutex allocation failed; cloud disabled.");
    return;
  }
  if (!configurationReady()) return;
  if (xTaskCreate(cloudWorker, "rack-cloud", 12288, nullptr, 1, &cloudTask) != pdPASS) {
    cloudTask = nullptr;
    rackLog.println("ERROR: cloud task allocation failed; Hall diagnostics only.");
  }
}

void loop() {
  static uint32_t lastSample = millis() - RACK_SAMPLE_MS;
  const uint32_t now = millis();
  static uint32_t lastHeartbeat = millis() - 2000u;
  if (uint32_t(now - lastHeartbeat) >= 2000u) {
    lastHeartbeat = now;
    rackLog.printf("[ALIVE] uptime=%lu ms | WiFi=%s | cloud worker=%s\n",
                   static_cast<unsigned long>(now),
                   WiFi.status() == WL_CONNECTED ? "connected" : "disconnected",
                   cloudTask ? "running" : "disabled (check settings)");
    rackLog.print("[HALL SNAPSHOT] ");
    for (size_t i = 0; i < rack::kSlotCount; ++i) {
      const bool low = digitalRead(rack::kHallPins[i]) == LOW;
      rackLog.printf("S%u(GPIO%u)=%s/%s ", unsigned(i + 1), rack::kHallPins[i],
                     low ? "LOW" : "HIGH",
                     low == RACK_OCCUPIED_WHEN_LOW ? "detected" : "not-detected");
    }
    rackLog.println();
  }
  if (sensorMutex && uint32_t(now - lastSample) >= RACK_SAMPLE_MS) {
    lastSample = now;
    for (size_t i = 0; i < rack::kSlotCount; ++i) {
      const bool occupied = (digitalRead(rack::kHallPins[i]) == LOW) == RACK_OCCUPIED_WHEN_LOW;
      xSemaphoreTake(sensorMutex, portMAX_DELAY);
      const bool rawChanged = !sensors[i].initialized || sensors[i].rawOccupied != occupied;
      const bool changed = rack::sample(sensors[i], occupied, now, RACK_STABLE_MS);
      const rack::Sensor current = sensors[i];
      xSemaphoreGive(sensorMutex);
      if (rawChanged && RACK_VERBOSE_SYNC)
        rackLog.printf("[HALL RAW] %lu ms | Slot %u GPIO %u=%s candidate=%s stable=%s\n",
                      static_cast<unsigned long>(now), unsigned(i + 1), rack::kHallPins[i],
                      occupied == RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH",
                      occupied ? "occupied" : "vacant",
                      current.baselineReady ? (current.stableOccupied ? "occupied" : "vacant") : "unknown");
      if (changed) {
        rackLog.printf("[HALL UPDATE] %lu ms | Slot %u GPIO %u | %s | stable for %lu ms\n",
                      static_cast<unsigned long>(now), unsigned(i + 1), rack::kHallPins[i],
                      occupied ? "DETECTED / ON RACK" : "NOT DETECTED / OFF RACK",
                      static_cast<unsigned long>(RACK_STABLE_MS));
        if (cloudTask) xTaskNotifyGive(cloudTask);
      }
    }
  }
  delay(1);  // Yield to FreeRTOS, never wait for Wi-Fi/HTTP in this loop.
}
#endif  // RACK_LOGIC_TEST

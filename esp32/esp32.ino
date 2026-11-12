// Target: ESP32-S3 with the Espressif Arduino core, ArduinoJson 7, and hd44780.
// Generic compile target: esp32:esp32:esp32s3; verify board-specific pins/USB/flash before upload.
#include <stddef.h>
#include <stdint.h>
#include <time.h>
#include <stdio.h>
#include <string.h>

// EDIT SETTINGS HERE. This sketch needs no project headers or config.h.
// Keep real Wi-Fi credentials out of Git and shared copies of this file.
constexpr char RACK_WIFI_SSID[] = "";
constexpr char RACK_WIFI_PASSWORD[] = "";  // Empty is allowed for an open test network.
constexpr char RACK_FIREBASE_API_KEY[] = "AIzaSyAUaPCap80W1HiUiAj6QROvEFMLwuXUTFs";  // Public web API key, never a service-account key.
constexpr char RACK_FIREBASE_APP_ID[] = "1:620426609195:web:8120d4be0bb9f9cc0fe06e";   // Same app ID as the phone's Firebase app.
constexpr char RACK_PROJECT[] = "mart-parking-fdd6b";
constexpr char RACK_REGION[] = "asia-southeast1";
constexpr char RACK_SERVICE[] = "smart-supermarket-service";
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

// RAM-only cloud assignment cache. A vacant awaiting-placement slot never blinks.
struct LedAssignment {
  bool known = false;
  bool assigned = false;
  bool previouslyOnRack = false;
};

inline void observePlacement(LedAssignment &a, const Sensor &s) {
  if (a.known && a.assigned && s.baselineReady && s.stableOccupied)
    a.previouslyOnRack = true;
}

inline void updateAssignment(LedAssignment &a, bool sameIdentity, bool assigned,
                             bool cloudPreviouslyOnRack, const Sensor &s) {
  if (!sameIdentity) a = LedAssignment{};
  a.known = true;
  a.assigned = assigned;
  a.previouslyOnRack = assigned && (a.previouslyOnRack || cloudPreviouslyOnRack);
  observePlacement(a, s);
}

// Wire digits: 0=off, 1=on/free, 2=blink/removed but still assigned.
inline char ledMode(const LedAssignment &a, const Sensor &s) {
  if (!s.baselineReady || s.stableOccupied || !a.known) return '0';
  if (!a.assigned) return '1';
  return a.previouslyOnRack ? '2' : '0';
}

// Button bits: back=1, mode=2, next=4. One event per debounced press.
struct SlotBrowser {
  size_t slot = 0;
  bool showTime = false;
  uint8_t candidate = 0;
  uint8_t stable = 0;
  bool blocked = false;
  uint32_t candidateSince = 0;
  uint32_t pageSince = 0;

  bool poll(uint8_t pressed, uint32_t now) {
    if (pressed && (pressed & (pressed - 1))) blocked = true;
    if (pressed != candidate) {
      candidate = pressed;
      candidateSince = now;
    }
    if (uint32_t(now - candidateSince) < 30u) return false;
    if (!pressed) blocked = false;
    if (stable == pressed) return false;
    stable = pressed;
    if (!pressed || blocked) return false;
    if (pressed == 1) slot = (slot + kSlotCount - 1) % kSlotCount;
    else if (pressed == 2) showTime = !showTime;
    else if (pressed == 4) slot = (slot + 1) % kSlotCount;
    else return false;
    pageSince = now;
    return true;
  }
};

inline int monthDays(int year, int month) {
  const int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
  return days[month - 1] + (month == 2 && year % 4 == 0 &&
                            (year % 100 != 0 || year % 400 == 0));
}

inline int decimal(const char *text, size_t count) {
  int value = 0;
  for (size_t i = 0; i < count; ++i) {
    if (text[i] < '0' || text[i] > '9') return -1;
    value = value * 10 + text[i] - '0';
  }
  return value;
}

// Firebase RFC3339 timestamp -> Philippine time, independent of system TZ/NTP.
inline bool assignedTimeText(const char *text, char (&out)[17]) {
  const size_t length = strlen(text);
  if (length < 20 || text[4] != '-' || text[7] != '-' || text[10] != 'T' ||
      text[13] != ':' || text[16] != ':') return false;
  int year = decimal(text, 4), month = decimal(text + 5, 2), day = decimal(text + 8, 2);
  const int hour = decimal(text + 11, 2), minute = decimal(text + 14, 2);
  const int second = decimal(text + 17, 2);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > monthDays(year, month) ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59)
    return false;
  size_t pos = 19;
  if (text[pos] == '.') {
    const size_t start = ++pos;
    while (text[pos] >= '0' && text[pos] <= '9') ++pos;
    if (start == pos) return false;
  }
  int offset = 0;
  if (text[pos] == 'Z' && pos + 1 == length) {
    // UTC.
  } else if ((text[pos] == '+' || text[pos] == '-') && pos + 6 == length && text[pos + 3] == ':') {
    const int hours = decimal(text + pos + 1, 2), minutes = decimal(text + pos + 4, 2);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return false;
    offset = (hours * 60 + minutes) * (text[pos] == '+' ? 1 : -1);
  } else return false;
  int localMinutes = hour * 60 + minute - offset + 8 * 60;
  while (localMinutes < 0) {
    localMinutes += 1440;
    if (--day == 0) {
      if (--month == 0) { month = 12; --year; }
      day = monthDays(year, month);
    }
  }
  while (localMinutes >= 1440) {
    localMinutes -= 1440;
    if (++day > monthDays(year, month)) {
      day = 1;
      if (++month == 13) { month = 1; ++year; }
    }
  }
  if (year < 1 || year > 9999) return false;
  snprintf(out, sizeof(out), "%04d-%02d-%02d %02d:%02d", year, month, day,
           localMinutes / 60, localMinutes % 60);
  return true;
}

inline void lcdRow(char (&out)[17], const char *text, size_t page = 0) {
  const size_t length = strlen(text);
  const size_t offset = (page % (length ? (length + 15) / 16 : 1)) * 16;
  for (size_t i = 0; i < 16; ++i) {
    const unsigned char value = offset + i < length ? text[offset + i] : ' ';
    out[i] = value >= 32 && value <= 126 ? static_cast<char>(value) : '?';
  }
  out[16] = '\0';
}

inline void browserDetail(char (&out)[17], bool known, bool assigned, bool showTime,
                          const char *content, uint32_t pageElapsed) {
  char timestamp[17];
  if (!known) lcdRow(out, "Sync pending");
  else if (!assigned) lcdRow(out, "Unassigned");
  else if (showTime)
    lcdRow(out, assignedTimeText(content, timestamp) ? timestamp : "Time unavailable");
  else lcdRow(out, content, pageElapsed / 1000u);
}
}  // namespace rack

#ifndef RACK_LOGIC_TEST
#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <hd44780.h>
#include <hd44780ioClass/hd44780_I2Cexp.h>
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
rack::LedAssignment ledAssignments[rack::kSlotCount];
String assignedProductIDs[rack::kSlotCount];  // Protected by sensorMutex too.
String assignedAtTimes[rack::kSlotCount];  // Distinguish a new assignment of the same box.
SemaphoreHandle_t sensorMutex = nullptr;
TaskHandle_t cloudTask = nullptr;
hd44780_I2Cexp rackLcd;  // Auto-detect backpack address and pin mapping.
rack::SlotBrowser browser;
bool lcdReady = false;
constexpr uint8_t kPrevPin = 11, kModePin = 12, kNextPin = 10;

void setupLcd() {
  for (uint8_t pin : {kPrevPin, kModePin, kNextPin}) pinMode(pin, INPUT_PULLUP);
  Wire.begin(8, 9, 100000);
  Wire.setTimeOut(10);  // Bound failed transactions on a disconnected/stuck bus.
  const int status = rackLcd.begin(16, 2);
  lcdReady = status == 0;
  if (!lcdReady) rackLog.printf("LCD: initialization failed (%d); rack continues without display.\n", status);
}

void serviceLcd(uint32_t now) {
  const uint8_t pressed = (digitalRead(kPrevPin) == LOW ? 1 : 0) |
                          (digitalRead(kModePin) == LOW ? 2 : 0) |
                          (digitalRead(kNextPin) == LOW ? 4 : 0);
  const bool navigation = browser.poll(pressed, now);
  if (!lcdReady) return;
  static uint32_t lastRefresh = 0;
  static char desired[2][17] = {};
  static char displayed[2][17] = {};
  static String lastContent;
  static bool lastKnown = false, lastAssigned = false;
  if (navigation || !desired[0][0] || uint32_t(now - lastRefresh) >= 20u) {
    lastRefresh = now;
    String content;
    bool known = false, assigned = false;
    if (sensorMutex) {
      xSemaphoreTake(sensorMutex, portMAX_DELAY);
      known = ledAssignments[browser.slot].known;
      assigned = ledAssignments[browser.slot].assigned;
      content = browser.showTime ? assignedAtTimes[browser.slot] : assignedProductIDs[browser.slot];
      xSemaphoreGive(sensorMutex);
    }
    if (content != lastContent || known != lastKnown || assigned != lastAssigned) {
      browser.pageSince = now;
      lastContent = content;
      lastKnown = known;
      lastAssigned = assigned;
    }
    char heading[17];
    snprintf(heading, sizeof(heading), browser.showTime ? "Slot %u Time +08" : "Slot %u Product",
             unsigned(browser.slot + 1));
    rack::lcdRow(desired[0], heading);
    rack::browserDetail(desired[1], known, assigned, browser.showTime, content.c_str(),
                         uint32_t(now - browser.pageSince));
  }
  // Update at most one dirty character per loop, with bounded I2C work. No clear/flicker.
  for (uint8_t row = 0; row < 2; ++row) {
    for (uint8_t col = 0; col < 16; ++col) {
      if (displayed[row][col] == desired[row][col]) continue;
      if (rackLcd.setCursor(col, row) != 0 || rackLcd.write(uint8_t(desired[row][col])) != 1) {
        lcdReady = false;
        rackLog.println("LCD: write failed; display disabled until restart, rack continues.");
      } else displayed[row][col] = desired[row][col];
      return;
    }
  }
}

void sendLedModes(uint32_t now) {
  static char previous[rack::kSlotCount] = {};
  static uint32_t lastSent = 0;
  static bool sent = false;
  char frame[] = "L:00000000\n";
  if (sensorMutex) {
    xSemaphoreTake(sensorMutex, portMAX_DELAY);
    for (size_t i = 0; i < rack::kSlotCount; ++i)
      frame[i + 2] = rack::ledMode(ledAssignments[i], sensors[i]);
    xSemaphoreGive(sensorMutex);
  }
  if (!sent || memcmp(previous, frame + 2, rack::kSlotCount) != 0 ||
      uint32_t(now - lastSent) >= 1000u) {
    Serial1.write(reinterpret_cast<const uint8_t *>(frame), sizeof(frame) - 1);
    memcpy(previous, frame + 2, rack::kSlotCount);
    lastSent = now;
    sent = true;
  }
}

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
  // Missing/malformed assignment fields must not turn a vacant slot into "free".
  const JsonVariantConst product = slot["productID"];
  const char *assignedAt = slot["assignedAt"] | "";
  const char *status = slot["stock"]["currentStatus"] | "";
  const bool assigned = product.is<const char *>() && strlen(product.as<const char *>()) > 0;
  const bool cloudPreviouslyOnRack = strcmp(status, "OCCUPIED") == 0 ||
                                     strcmp(status, "PENDING_DISPATCH") == 0;
  if (!product.isUnbound() &&
      (product.isNull() || (assigned && strlen(assignedAt) &&
                           (cloudPreviouslyOnRack || strcmp(status, "EMPTY") == 0)))) {
    const String identity = assigned ? product.as<const char *>() : "";
    const String assignmentTime = assigned ? assignedAt : "";
    xSemaphoreTake(sensorMutex, portMAX_DELAY);
    const bool sameIdentity = ledAssignments[index].known && assignedProductIDs[index] == identity &&
                              assignedAtTimes[index] == assignmentTime;
    rack::updateAssignment(ledAssignments[index], sameIdentity, assigned,
                           cloudPreviouslyOnRack, sensors[index]);
    assignedProductIDs[index] = identity;
    assignedAtTimes[index] = assignmentTime;
    xSemaphoreGive(sensorMutex);
  } else {
    rackLog.printf("LED: slot %u invalid assignment response; keeping cached assignment.\n",
                   unsigned(index + 1));
  }
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
  Serial1.begin(9600, SERIAL_8N1, 14, 13);  // UNO D12 -> divider -> RX; TX -> UNO D11.
  sendLedModes(millis());  // All OFF until sensor baselines and assignments are known.
#if defined(ARDUINO_USB_CDC_ON_BOOT) && ARDUINO_USB_CDC_ON_BOOT
  Serial0.begin(115200);
#endif
  rackLog.println("[BOOT] Rack S3 logging v2 — heartbeat every 2 seconds; monitor at 115200 baud.");
  rackLog.printf("Rack MVP: %s=occupied; report occupancy only; cloud resolves assignment/status/activity.\n",
                RACK_OCCUPIED_WHEN_LOW ? "LOW" : "HIGH");
  rackLog.println("Slot 3 Hall input is GPIO 6. Serial Monitor: 115200 baud.");
  for (uint8_t pin : rack::kHallPins) pinMode(pin, INPUT_PULLUP);
  setupLcd();  // Independent of cloud configuration; browsing works offline too.
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
      rack::observePlacement(ledAssignments[i], sensors[i]);
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
  sendLedModes(now);
  serviceLcd(now);
  delay(1);  // Yield to FreeRTOS, never wait for Wi-Fi/HTTP in this loop.
}
#endif  // RACK_LOGIC_TEST

// Arduino UNO: output driver only. ESP32 owns every slot decision.
#include <stddef.h>
#include <stdint.h>

namespace rackOutput {
constexpr size_t kSlotCount = 8;
constexpr uint32_t kTimeoutMs = 3000;

struct Driver {
  char modes[kSlotCount] = {'0', '0', '0', '0', '0', '0', '0', '0'};
  char line[10] = {};  // L: followed by exactly eight mode digits.
  size_t length = 0;
  bool discard = false;
  bool received = false;
  uint32_t lastValid = 0;
  uint32_t rejectedFrames = 0;

  // Only a complete valid line can change outputs or refresh the watchdog.
  bool consume(char value, uint32_t now) {
    if (value != '\n') {
      if (length < sizeof(line)) line[length++] = value;
      else discard = true;
      return false;
    }
    bool valid = !discard && length == sizeof(line) && line[0] == 'L' && line[1] == ':';
    for (size_t i = 2; valid && i < sizeof(line); ++i)
      valid = line[i] >= '0' && line[i] <= '2';
    length = 0;
    discard = false;
    if (!valid) { ++rejectedFrames; return false; }
    for (size_t i = 0; i < kSlotCount; ++i) modes[i] = line[i + 2];
    received = true;
    lastValid = now;
    return true;
  }

  bool level(size_t slot, uint32_t now, bool blinkOn) const {
    if (!received || uint32_t(now - lastValid) >= kTimeoutMs) return false;
    return modes[slot] == '1' || (modes[slot] == '2' && blinkOn);
  }
};
}  // namespace rackOutput

#ifndef RACK_OUTPUT_TEST
#include <Arduino.h>
#include <SoftwareSerial.h>

SoftwareSerial rackSerial(11, 12);  // RX from ESP32 GPIO13; TX through divider to GPIO14.
rackOutput::Driver driver;
constexpr uint8_t kLedPins[rackOutput::kSlotCount] = {2, 3, 4, 5, 6, 7, 8, 9};
constexpr uint8_t kBuzzerPin = 10;

void setup() {
  Serial.begin(115200);
  Serial.println("[UNO BOOT] LED driver ready. ESP32 link: RX D11 / TX D12 at 9600 baud.");
  Serial.println("[UNO INFO] LCD is on the ESP32; view LCD diagnostics on the ESP32 USB port.");
  for (uint8_t pin : kLedPins) {
    digitalWrite(pin, LOW);
    pinMode(pin, OUTPUT);
  }
  digitalWrite(kBuzzerPin, LOW);
  pinMode(kBuzzerPin, OUTPUT);
  rackSerial.begin(9600);
  rackSerial.print("U:WAIT\n");
}

void loop() {
  const uint32_t now = millis();
  static uint32_t lastBlink = 0;
  static bool blinkOn = true;
  const uint32_t ticks = uint32_t(now - lastBlink) / 500u;
  if (ticks) {
    if (ticks % 2u) blinkOn = !blinkOn;
    lastBlink += ticks * 500u;
  }
  // Bound work so continuous malformed traffic cannot stall output updates.
  bool accepted = false;
  for (uint8_t count = 0; count < 32 && rackSerial.available(); ++count)
    accepted = driver.consume(static_cast<char>(rackSerial.read()), now) || accepted;
  for (size_t i = 0; i < rackOutput::kSlotCount; ++i)
    digitalWrite(kLedPins[i], driver.level(i, now, blinkOn) ? HIGH : LOW);
  static bool timeoutReported = false;
  if (accepted) {
    // Reply only after applying outputs. Digits report modes, not lamp feedback.
    char reply[] = "A:00000000\n";
    for (size_t i = 0; i < rackOutput::kSlotCount; ++i) reply[i + 2] = driver.modes[i];
    rackSerial.print(reply);
    timeoutReported = false;
  } else if (driver.received && uint32_t(now - driver.lastValid) >= rackOutput::kTimeoutMs && !timeoutReported) {
    rackSerial.print("U:TIMEOUT\n");
    timeoutReported = true;
  }
  static uint32_t lastLog = 0;
  static uint32_t receiveOverflows = 0;
  if (rackSerial.overflow()) ++receiveOverflows;
  if (uint32_t(now - lastLog) >= 2000u) {
    lastLog = now;
    const bool active = driver.received && uint32_t(now - driver.lastValid) < rackOutput::kTimeoutMs;
    Serial.print("[UNO LED] ");
    Serial.print(!driver.received ? "WAITING FOR ESP32" : active ? "RECEIVING" : "TIMEOUT: OUTPUTS OFF");
    Serial.print(" | lastCmd=");
    for (size_t i = 0; i < rackOutput::kSlotCount; ++i) Serial.print(driver.modes[i]);
    Serial.print(" | D2-D9=");
    for (uint8_t pin : kLedPins) Serial.print(digitalRead(pin) == HIGH ? '1' : '0');
    Serial.print(" | ageMs=");
    if (driver.received) Serial.print(uint32_t(now - driver.lastValid));
    else Serial.print("never");
    Serial.print(" | badFrames="); Serial.print(driver.rejectedFrames);
    Serial.print(" | rxOverflows="); Serial.println(receiveOverflows);
  }
}
#endif  // RACK_OUTPUT_TEST

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
    if (!valid) return false;
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
  for (uint8_t pin : kLedPins) {
    digitalWrite(pin, LOW);
    pinMode(pin, OUTPUT);
  }
  digitalWrite(kBuzzerPin, LOW);
  pinMode(kBuzzerPin, OUTPUT);
  rackSerial.begin(9600);
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
  for (uint8_t count = 0; count < 32 && rackSerial.available(); ++count)
    driver.consume(static_cast<char>(rackSerial.read()), now);
  for (size_t i = 0; i < rackOutput::kSlotCount; ++i)
    digitalWrite(kLedPins[i], driver.level(i, now, blinkOn) ? HIGH : LOW);
}
#endif  // RACK_OUTPUT_TEST

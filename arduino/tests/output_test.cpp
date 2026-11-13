#define RACK_OUTPUT_TEST
#include "../arduino.ino"
#include <assert.h>
#include <iostream>
#include <limits>

bool feed(rackOutput::Driver &d, const char *text, uint32_t now) {
  bool accepted = false;
  while (*text) accepted = d.consume(*text++, now) || accepted;
  return accepted;
}

int main() {
  rackOutput::Driver d;
  for (size_t i = 0; i < 8; ++i) assert(!d.level(i, 0, true));
  assert(!feed(d, "L:012", 100));
  assert(!d.received);  // No partial updates.
  assert(feed(d, "01201\n", 100));
  assert(!d.level(0, 100, true));
  assert(d.level(1, 100, false));
  assert(d.level(2, 100, true));
  assert(!d.level(2, 100, false));
  assert(d.level(7, 100, false));

  for (const char *bad : {"L:111\n", "X:11111111\n", "L:11111113\n",
                          "L:111111111\n", "L:11111111\r\n",
                          "garbageL:11111111\n", "\n"}) {
    const uint32_t previousRejected = d.rejectedFrames;
    assert(!feed(d, bad, 200));
    assert(d.rejectedFrames == previousRejected + 1);
    assert(d.lastValid == 100);
    assert(d.modes[0] == '0' && d.modes[2] == '2');
  }
  assert(d.level(1, 3099, false));
  for (size_t i = 0; i < 8; ++i) assert(!d.level(i, 3100, true));
  assert(feed(d, "L:22222222\n", 4000));
  assert(!d.level(0, 4000, false));  // Heartbeats do not override the blink phase.
  assert(feed(d, "L:22222222\n", 4500));
  for (size_t i = 0; i < 8; ++i) {
    assert(d.level(i, 4500, true));
    assert(!d.level(i, 4500, false));
  }

  const uint32_t start = std::numeric_limits<uint32_t>::max() - 100;
  assert(feed(d, "L:11111111\n", start));
  assert(d.level(0, uint32_t(start + 2999), false));
  assert(!d.level(0, uint32_t(start + 3000), true));
  std::cout << "PASS: atomic frames, mode levels, malformed recovery, heartbeat, timeout, millis wrap\n";
}

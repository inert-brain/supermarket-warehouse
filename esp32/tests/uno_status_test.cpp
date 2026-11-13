#define RACK_LOGIC_TEST
#include "../esp32.ino"
#include <assert.h>
#include <iostream>
#include <limits>

bool feed(rack::UnoStatus &s, const char *text, uint32_t now) {
  bool valid = false;
  while (*text) valid = s.consume(*text++, now) || valid;
  return valid;
}
int main() {
  assert(rack::ledFrameDue(false, false, 0));
  assert(!rack::ledFrameDue(true, true, 20));
  assert(!rack::ledFrameDue(true, true, 49));
  assert(rack::ledFrameDue(true, true, 50));
  assert(!rack::ledFrameDue(true, false, 999));
  assert(rack::ledFrameDue(true, false, 1000));
  rack::UnoStatus s;
  assert(!s.online(0));
  assert(feed(s, "U:WAIT\n", 10) && s.state == 'W');
  assert(!feed(s, "A:012", 100));
  assert(s.state == 'W');
  assert(feed(s, "01201\n", 110));
  assert(strcmp(s.modes, "01201201") == 0);
  assert(s.online(3109) && !s.online(3110));
  for (const char *bad : {"A:99999999\n", "garbageA:11111111\n", "A:111\n", "A:11111111\r\n"})
    assert(!feed(s, bad, 5000));
  assert(s.lastReply == 110);
  assert(feed(s, "U:TIMEOUT\n", 5100) && s.state == 'T');
  assert(feed(s, "A:11111111\n", 5200) && s.state == 'A');
  const uint32_t start = std::numeric_limits<uint32_t>::max() - 10;
  assert(feed(s, "A:00000000\n", start));
  assert(s.online(uint32_t(start + 2999)) && !s.online(uint32_t(start + 3000)));
  std::cout << "PASS: UNO status frames, malformed recovery, freshness and millis wrap\n";
}

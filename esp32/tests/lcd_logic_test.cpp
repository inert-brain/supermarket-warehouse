#define RACK_LOGIC_TEST
#include "../esp32.ino"
#include <assert.h>
#include <iostream>
#include <limits>

void navigation() {
  rack::SlotBrowser b;
  assert(b.slot == 0 && b.page == rack::SlotPage::Status);
  assert(!b.poll(1, 100));
  assert(!b.poll(0, 110));  // Bounce.
  assert(!b.poll(1, 120));
  assert(!b.poll(1, 149));
  assert(b.poll(1, 150) && b.slot == 7);
  assert(!b.poll(1, 5000) && b.slot == 7);  // No hold repeat.
  b.poll(0, 5010); b.poll(0, 5040);
  b.poll(2, 5050);
  assert(b.poll(2, 5080) && b.page == rack::SlotPage::Container);
  b.poll(0, 5090); b.poll(0, 5120);
  b.poll(4, 5130);
  assert(b.poll(4, 5160) && b.slot == 0 && b.page == rack::SlotPage::Container);
  assert(b.pageSince == 5160);
  b.poll(0, 5170); b.poll(0, 5200);
  b.poll(3, 5210);
  assert(!b.poll(3, 5240));
  b.poll(1, 5250);  // Releasing only one chord button must not navigate.
  assert(!b.poll(1, 5280) && b.slot == 0);
  b.poll(0, 5290); b.poll(0, 5320);
  b.poll(2, 5330);
  assert(b.poll(2, 5360) && b.page == rack::SlotPage::Stock);
  b.poll(0, 5370); b.poll(0, 5400);
  b.poll(2, 5410);
  assert(b.poll(2, 5440) && b.page == rack::SlotPage::AssignedTime);
  b.poll(0, 5450); b.poll(0, 5480);
  b.poll(2, 5490);
  assert(b.poll(2, 5520) && b.page == rack::SlotPage::Status);

  rack::SlotBrowser wrap;
  const uint32_t start = std::numeric_limits<uint32_t>::max() - 10;
  assert(!wrap.poll(4, start));
  assert(!wrap.poll(4, uint32_t(start + 29)));
  assert(wrap.poll(4, uint32_t(start + 30)) && wrap.slot == 1);
}

void slotStatus() {
  rack::Sensor sensor;
  rack::LedAssignment assignment;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Reading sensor") == 0);
  sensor.baselineReady = true;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Sync pending") == 0);
  assignment.known = true;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Free slot") == 0);
  sensor.stableOccupied = true;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Unidentified") == 0);
  assignment.assigned = true;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Occupied") == 0);
  sensor.stableOccupied = false;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Await placement") == 0);
  assignment.previouslyOnRack = true;
  assert(strcmp(rack::slotStatusText(sensor, assignment), "Off-rack") == 0);
}

void timestamps() {
  char out[17];
  struct Example { const char *input; const char *expected; };
  for (const Example &e : {
      Example{"2026-11-12T08:30:00Z", "2026-11-12 16:30"},
      Example{"2026-12-31T20:05:59.123456Z", "2027-01-01 04:05"},
      Example{"2024-02-29T18:00:00+00:00", "2024-03-01 02:00"},
      Example{"2026-11-12T16:30:00+08:00", "2026-11-12 16:30"},
      Example{"2026-11-12T23:30:00-05:30", "2026-11-13 13:00"},
      Example{"2026-01-01T00:00:00+14:00", "2025-12-31 18:00"}}) {
    assert(rack::assignedTimeText(e.input, out));
    assert(strcmp(out, e.expected) == 0);
  }
  for (const char *invalid : {"", "2026", "2026-02-29T00:00:00Z", "2026-13-01T00:00:00Z",
       "2026-11-12T24:00:00Z", "2026-11-12T00:60:00Z", "2026-11-12T00:00:00.Z",
       "2026-11-12T00:00:00", "2026-11-12T00:00:00+25:00", "2026-11-12T00:00:00Zjunk",
       "2026-11-12T00:00:00+00:0x", "9999-12-31T23:00:00Z", "0001-01-01T00:00:00+14:00"})
    assert(!rack::assignedTimeText(invalid, out));
}

void rows() {
  char row[17];
  rack::browserDetail(row, false, false, false, "", 0);
  assert(strcmp(row, "Sync pending    ") == 0);
  rack::browserDetail(row, true, false, true, "", 0);
  assert(strcmp(row, "Unassigned      ") == 0);
  rack::browserDetail(row, true, true, true, "bad timestamp", 0);
  assert(strcmp(row, "Time unavailable") == 0);
  rack::browserDetail(row, true, true, true, "2026-11-12T08:30:00Z", 0);
  assert(strcmp(row, "2026-11-12 16:30") == 0);
  rack::browserDetail(row, true, true, false, "1234567890123456ABCDEFG", 999);
  assert(strcmp(row, "1234567890123456") == 0);
  rack::browserDetail(row, true, true, false, "1234567890123456ABCDEFG", 1000);
  assert(strcmp(row, "ABCDEFG         ") == 0);
  rack::lcdRow(row, "BOTTLE-01");
  assert(strcmp(row, "BOTTLE-01       ") == 0);
  rack::lcdRow(row, "1234567890123456ABCDEFG", 0);
  assert(strcmp(row, "1234567890123456") == 0);
  rack::lcdRow(row, "1234567890123456ABCDEFG", 1);
  assert(strcmp(row, "ABCDEFG         ") == 0);
  rack::lcdRow(row, "1234567890123456ABCDEFG", 2);
  assert(strcmp(row, "1234567890123456") == 0);
  rack::lcdRow(row, "");
  assert(strcmp(row, "                ") == 0);
  rack::lcdRow(row, "ID\n1");
  assert(strcmp(row, "ID?1            ") == 0);
}

int main() {
  navigation(); slotStatus(); timestamps(); rows();
  std::cout << "PASS: LCD navigation, debounce, chords, wrap, Philippine timestamps, row padding/paging\n";
}

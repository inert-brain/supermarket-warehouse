#define RACK_LOGIC_TEST
#include "../esp32.ino"

#include <assert.h>
#include <iostream>
#include <limits>

using rack::ReportSchedule;
using rack::Sensor;
constexpr uint32_t kStableMs = RACK_STABLE_MS;

Sensor baseline(bool occupied, uint32_t start = 0) {
  Sensor s;
  assert(!rack::sample(s, occupied, start, kStableMs));
  assert(!rack::settled(s, start + kStableMs - 1, kStableMs));
  assert(rack::sample(s, occupied, start + kStableMs, kStableMs));
  assert(rack::settled(s, start + kStableMs, kStableMs));
  return s;
}

void startupAndHeartbeat() {
  Sensor cold;
  ReportSchedule report;
  assert(!rack::reportDue(cold, report, 1000));
  assert(!rack::sample(cold, true, 1000, kStableMs));
  assert(!rack::reportDue(cold, report, 1199));
  assert(!rack::sample(cold, false, 1200, kStableMs));
  assert(!rack::sample(cold, false, 1499, kStableMs));
  assert(!rack::reportDue(cold, report, 1499));
  assert(rack::sample(cold, false, 1500, kStableMs));
  assert(rack::reportDue(cold, report, 1500));

  // Both occupied and vacant baselines report without any product/cloud lookup.
  for (bool occupied : {false, true}) {
    Sensor s = baseline(occupied);
    ReportSchedule heartbeat;
    assert(rack::reportDue(s, heartbeat, 300));
    rack::finishReport(heartbeat, s, true, 400);
    assert(!rack::reportDue(s, heartbeat, 400));
    for (uint32_t t = 420; t < 5400; t += RACK_SAMPLE_MS) {
      assert(!rack::sample(s, occupied, t, kStableMs));
      assert(!rack::reportDue(s, heartbeat, t));
    }
    assert(rack::reportDue(s, heartbeat, 5400));
    rack::finishReport(heartbeat, s, true, 5500);
    assert(!rack::reportDue(s, heartbeat, 10499));
    assert(rack::reportDue(s, heartbeat, 10500));
  }
}

void debounceAndUnsettledCandidates() {
  Sensor s = baseline(true);
  ReportSchedule report;
  rack::finishReport(report, s, true, 300);
  const uint32_t generation = s.generation;
  assert(!rack::sample(s, false, 400, kStableMs));
  assert(!rack::settled(s, 499, kStableMs));
  assert(!rack::reportDue(s, report, 499));
  assert(!rack::sample(s, true, 500, kStableMs));
  assert(!rack::settled(s, 799, kStableMs));
  assert(!rack::reportDue(s, report, 799));
  assert(!rack::sample(s, true, 800, kStableMs));  // A bump is not a stable edge.
  assert(rack::settled(s, 800, kStableMs));
  assert(s.generation != generation);  // It still invalidates in-flight work.
  assert(!rack::reportDue(s, report, 800));  // Per-slot retry floor.

  assert(!rack::sample(s, false, 900, kStableMs));
  assert(!rack::sample(s, false, 1199, kStableMs));
  assert(!rack::reportDue(s, report, 1199));
  assert(rack::sample(s, false, 1200, kStableMs));
  assert(!rack::reportDue(s, report, 1299));
  assert(rack::reportDue(s, report, 1300));
  rack::finishReport(report, s, true, 1300);
  const uint32_t removed = s.generation;
  for (uint32_t t = 1320; t < 5000; t += RACK_SAMPLE_MS)
    assert(!rack::sample(s, false, t, kStableMs));
  assert(s.generation == removed);
  assert(!rack::reportDue(s, report, 5000));
}

void networkGapGuards() {
  Sensor current = baseline(false);
  const Sensor beforeTLS = current;
  assert(rack::mayReport(beforeTLS, current, 310, kStableMs));
  assert(!rack::sample(current, true, 320, kStableMs));
  assert(!rack::mayReport(beforeTLS, current, 320, kStableMs));
  // A bounce back during TLS still cancels the captured request.
  assert(!rack::sample(current, false, 340, kStableMs));
  assert(!rack::mayReport(beforeTLS, current, 640, kStableMs));
  const Sensor fresh = current;
  assert(rack::mayReport(fresh, current, 640, kStableMs));
  // A full opposite stable cycle invalidates even the same old occupancy value.
  rack::sample(current, true, 700, kStableMs);
  rack::sample(current, true, 1000, kStableMs);
  rack::sample(current, false, 1020, kStableMs);
  rack::sample(current, false, 1320, kStableMs);
  assert(!rack::mayReport(fresh, current, 1320, kStableMs));
}

void slowRequestAndLatestState() {
  Sensor current = baseline(true);
  const Sensor inFlight = current;
  ReportSchedule report;
  // HTTPS waits while sampling accepts multiple edges, ending at vacancy.
  for (uint32_t start : {400u, 1000u, 1600u}) {
    const bool occupied = start == 1000;
    rack::sample(current, occupied, start, kStableMs);
    assert(rack::sample(current, occupied, start + kStableMs, kStableMs));
  }
  // A success acknowledges the SENT generation, never the latest sensor copy.
  rack::finishReport(report, inFlight, true, 2000);
  assert(!rack::reportDue(current, report, 2999));
  assert(rack::reportDue(current, report, 3000));
  assert(!current.stableOccupied);  // Next request is latest vacancy, no old edges.
  rack::finishReport(report, current, true, 3100);
  assert(!rack::reportDue(current, report, 4100));
  assert(rack::reportDue(current, report, 8100));

  // Moving away and back during POST still schedules a fresh same-state report.
  const Sensor sentVacant = current;
  rack::sample(current, true, 8200, kStableMs);
  rack::sample(current, true, 8500, kStableMs);
  rack::sample(current, false, 8600, kStableMs);
  rack::sample(current, false, 8900, kStableMs);
  rack::finishReport(report, sentVacant, true, 9000);
  assert(rack::reportDue(current, report, 10000));
}

void failureAndLostResponse() {
  Sensor current = baseline(false);
  ReportSchedule report;
  // A lost response may have committed. Retry reports occupancy, not an event;
  // only the server can guarantee no repeated product activity.
  rack::finishReport(report, current, false, 400);
  assert(!rack::reportDue(current, report, 1399));
  assert(rack::reportDue(current, report, 1400));
  const Sensor failed = current;
  rack::sample(current, true, 1500, kStableMs);
  rack::sample(current, true, 1800, kStableMs);
  rack::finishReport(report, failed, false, 2000);
  assert(rack::reportDue(current, report, 3000));
  assert(current.stableOccupied);  // Do not replay the failed vacancy.
  rack::finishReport(report, current, true, 3100);
  assert(!rack::reportDue(current, report, 4100));
  assert(rack::reportDue(current, report, 8100));
}

void allSlotsAndReconnect() {
  Sensor inputs[rack::kSlotCount];
  ReportSchedule reports[rack::kSlotCount];
  const uint8_t expectedPins[] = {4, 5, 6, 7, 15, 16, 17, 18};
  for (size_t i = 0; i < rack::kSlotCount; ++i) {
    assert(rack::kHallPins[i] == expectedPins[i]);
    inputs[i] = baseline(i % 2 == 0);
    assert(rack::reportDue(inputs[i], reports[i], 300));
    rack::finishReport(reports[i], inputs[i], true, 300);
  }
  rack::sample(inputs[0], false, 400, kStableMs);
  rack::sample(inputs[7], true, 400, kStableMs);
  rack::sample(inputs[0], false, 700, kStableMs);
  rack::sample(inputs[7], true, 700, kStableMs);
  for (size_t i = 0; i < rack::kSlotCount; ++i) {
    assert(rack::reportDue(inputs[i], reports[i], 1300) == (i == 0 || i == 7));
    rack::finishReport(reports[i], inputs[i], true, 1300);
  }
  // Heartbeats cover all eight, not just slots with stable edges.
  for (size_t i = 0; i < rack::kSlotCount; ++i)
    assert(rack::reportDue(inputs[i], reports[i], 6300));

  // Offline edges overwrite sensor state; reconnect forgets receipts, not sensors.
  rack::sample(inputs[1], true, 1400, kStableMs);
  rack::sample(inputs[1], true, 1700, kStableMs);
  rack::sample(inputs[1], false, 1800, kStableMs);
  rack::sample(inputs[1], false, 2100, kStableMs);
  rack::resetReports(reports);
  for (size_t i = 0; i < rack::kSlotCount; ++i)
    assert(rack::reportDue(inputs[i], reports[i], 2100));
  assert(!inputs[1].stableOccupied);
  // An unsettled slot cannot report on reconnect until its candidate settles.
  rack::sample(inputs[2], false, 2200, kStableMs);
  rack::resetReports(reports);
  assert(!rack::reportDue(inputs[2], reports[2], 2499));
  rack::sample(inputs[2], false, 2500, kStableMs);
  assert(rack::reportDue(inputs[2], reports[2], 2500));
}

void millisWraparound() {
  const uint32_t start = std::numeric_limits<uint32_t>::max() - 100;
  Sensor s = baseline(false, start);
  ReportSchedule report;
  const uint32_t ready = start + kStableMs;
  assert(rack::settled(s, ready, kStableMs));
  assert(rack::reportDue(s, report, ready));
  // Finish before wrap with a baseline that was already settled at that time.
  const Sensor early = baseline(true, uint32_t(start - kStableMs));
  rack::finishReport(report, early, true, start);
  assert(!rack::reportDue(early, report, uint32_t(start + kPollMs - 1)));
  assert(rack::reportDue(early, report, uint32_t(start + kPollMs)));

  rack::finishReport(report, early, false, start);
  assert(!rack::reportDue(early, report, uint32_t(start + kMinimumCycleMs - 1)));
  assert(rack::reportDue(early, report, uint32_t(start + kMinimumCycleMs)));
}

void ledLifecycle() {
  Sensor vacant = baseline(false);
  Sensor occupied = baseline(true);
  rack::LedAssignment a;
  assert(rack::ledMode(a, Sensor{}) == '0');
  assert(rack::ledMode(a, vacant) == '0');
  assert(rack::ledMode(a, occupied) == '0');

  rack::updateAssignment(a, false, false, false, vacant);
  assert(rack::ledMode(a, vacant) == '1');
  assert(rack::ledMode(a, occupied) == '0');  // Unidentified object.
  rack::updateAssignment(a, false, true, false, vacant);
  assert(rack::ledMode(a, vacant) == '0');  // Awaiting first placement.
  rack::observePlacement(a, occupied);
  assert(rack::ledMode(a, occupied) == '0');
  assert(rack::ledMode(a, vacant) == '2');  // Local removal, even offline.
  rack::updateAssignment(a, true, true, false, vacant);
  assert(rack::ledMode(a, vacant) == '2');  // Same assignment cannot erase placement.
  rack::observePlacement(a, occupied);
  assert(rack::ledMode(a, occupied) == '0');  // Returned without scanning.
  rack::updateAssignment(a, false, false, false, vacant);
  assert(rack::ledMode(a, vacant) == '1');  // Dispatch clears reservation.
  rack::updateAssignment(a, false, true, false, vacant);
  assert(rack::ledMode(a, vacant) == '0');  // New box has its own placement latch.
  rack::updateAssignment(a, false, true, true, vacant);
  assert(rack::ledMode(a, vacant) == '2');  // Boot with OCCUPIED/PENDING_DISPATCH cache.
  rack::updateAssignment(a, false, true, false, vacant);
  assert(rack::ledMode(a, vacant) == '0');  // Same barcode, new assignedAt: fresh placement.
  rack::updateAssignment(a, false, true, false, occupied);
  assert(a.previouslyOnRack);  // Assignment arrives while already physically present.

  // Raw bounce cannot change the accepted LED state or mark first placement.
  rack::LedAssignment waiting;
  rack::updateAssignment(waiting, false, true, false, vacant);
  rack::sample(vacant, true, 400, kStableMs);
  rack::observePlacement(waiting, vacant);
  assert(!waiting.previouslyOnRack);
  assert(rack::ledMode(waiting, vacant) == '0');
  rack::sample(vacant, true, 700, kStableMs);
  rack::observePlacement(waiting, vacant);
  assert(waiting.previouslyOnRack);
  rack::sample(vacant, false, 720, kStableMs);
  assert(rack::ledMode(waiting, vacant) == '0');
  rack::sample(vacant, false, 1020, kStableMs);
  assert(rack::ledMode(waiting, vacant) == '2');
}

int main() {
  ledLifecycle();
  startupAndHeartbeat();
  debounceAndUnsettledCandidates();
  networkGapGuards();
  slowRequestAndLatestState();
  failureAndLostResponse();
  allSlotsAndReconnect();
  millisWraparound();
  std::cout << "PASS: LED lifecycle, stable startup, heartbeats, debounce, TLS generation guards, latest-state retries, all eight slots, reconnect, millis wrap\n";
}

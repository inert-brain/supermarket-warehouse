#define RACK_LOGIC_TEST
#include "../esp32.ino"

#include <assert.h>
#include <iostream>
#include <limits>

using rack::Action;
using rack::CloudStatus;
using rack::Sensor;
constexpr uint32_t kStableMs = RACK_STABLE_MS;

Sensor baseline(bool occupied, uint32_t start = 0) {
  Sensor s;
  assert(!rack::sample(s, occupied, start, kStableMs));
  assert(!rack::settled(s, start + 299, kStableMs));
  assert(rack::sample(s, occupied, start + 300, kStableMs));
  assert(rack::settled(s, start + 300, kStableMs));
  return s;
}

void startupAndDecisionTable() {
  Sensor cold;
  assert(rack::decide(cold, CloudStatus::Occupied, 1000, kStableMs) == Action::None);
  for (bool occupied : {false, true}) {
    const Sensor s = baseline(occupied);
    for (CloudStatus cloud : {CloudStatus::Unassigned, CloudStatus::Occupied,
                              CloudStatus::PendingDispatch, CloudStatus::Invalid}) {
      Action expected = Action::None;
      if (!occupied && cloud == CloudStatus::Occupied) expected = Action::TakeOffRack;
      if (occupied && cloud == CloudStatus::PendingDispatch) expected = Action::ReturnProduct;
      assert(rack::decide(s, cloud, 300, kStableMs) == expected);
    }
  }
}

void debounceAndUnsettledCandidates() {
  Sensor s = baseline(true);
  const uint32_t generation = s.generation;
  assert(!rack::sample(s, false, 400, kStableMs));
  assert(!rack::settled(s, 699, kStableMs));
  // The OLD stable occupied value must not produce a ReturnProduct during bounce.
  assert(rack::decide(s, CloudStatus::PendingDispatch, 699, kStableMs) == Action::None);
  assert(!rack::sample(s, true, 500, kStableMs));
  assert(!rack::settled(s, 799, kStableMs));
  assert(rack::decide(s, CloudStatus::PendingDispatch, 799, kStableMs) == Action::None);
  assert(!rack::sample(s, true, 800, kStableMs));  // No stable transition from a bump.
  assert(rack::settled(s, 800, kStableMs));
  assert(s.generation != generation);  // Nevertheless invalidates in-flight work.

  assert(!rack::sample(s, false, 900, kStableMs));
  assert(!rack::sample(s, false, 1199, kStableMs));
  assert(rack::sample(s, false, 1200, kStableMs));
  assert(rack::decide(s, CloudStatus::Occupied, 1200, kStableMs) == Action::TakeOffRack);
  const uint32_t removed = s.generation;
  for (uint32_t t = 1220; t < 5000; t += RACK_SAMPLE_MS) assert(!rack::sample(s, false, t, kStableMs));
  assert(s.generation == removed);
}

void networkGapGuards() {
  Sensor current = baseline(false);
  const Sensor beforeRead = current;
  assert(rack::mayMutate(beforeRead, current, 310, kStableMs));
  assert(!rack::sample(current, true, 320, kStableMs));
  assert(!rack::mayMutate(beforeRead, current, 320, kStableMs));
  // Return to the same stable value while a query/handshake is blocked.
  assert(!rack::sample(current, false, 340, kStableMs));
  assert(!rack::mayMutate(beforeRead, current, 640, kStableMs));
  const Sensor fresh = current;
  assert(rack::mayMutate(fresh, current, 640, kStableMs));
  // A full opposite stable cycle also invalidates the old generation.
  rack::sample(current, true, 700, kStableMs);
  rack::sample(current, true, 1000, kStableMs);
  rack::sample(current, false, 1020, kStableMs);
  rack::sample(current, false, 1320, kStableMs);
  assert(!rack::mayMutate(fresh, current, 1320, kStableMs));
}

void currentStateReconciliation() {
  Sensor s = baseline(true);
  rack::sample(s, false, 400, kStableMs);
  rack::sample(s, false, 700, kStableMs);
  assert(rack::decide(s, CloudStatus::Occupied, 700, kStableMs) == Action::TakeOffRack);
  // Lost response AFTER commit: the next fresh read prevents a duplicate write.
  assert(rack::decide(s, CloudStatus::PendingDispatch, 800, kStableMs) == Action::None);
  // Failure BEFORE commit can be reconsidered only from newly read cloud state.
  assert(rack::decide(s, CloudStatus::Occupied, 800, kStableMs) == Action::TakeOffRack);
  // Phone dispatch/reassignment to unassigned never creates a sensor receipt.
  assert(rack::decide(s, CloudStatus::Unassigned, 800, kStableMs) == Action::None);
  rack::sample(s, true, 900, kStableMs);
  rack::sample(s, true, 1200, kStableMs);
  assert(rack::decide(s, CloudStatus::PendingDispatch, 1200, kStableMs) == Action::ReturnProduct);
  assert(rack::decide(s, CloudStatus::Occupied, 1200, kStableMs) == Action::None);
  assert(rack::decide(s, CloudStatus::Unassigned, 1200, kStableMs) == Action::None);
}

void independentSlotsAndMillisWrap() {
  Sensor inputs[rack::kSlotCount];
  const uint8_t expectedPins[] = {4, 5, 6, 7, 15, 16, 17, 18};
  for (size_t i = 0; i < rack::kSlotCount; ++i) {
    assert(rack::kHallPins[i] == expectedPins[i]);
    inputs[i] = baseline(true);
  }
  rack::sample(inputs[0], false, 400, kStableMs);
  rack::sample(inputs[7], false, 400, kStableMs);
  rack::sample(inputs[0], false, 700, kStableMs);
  rack::sample(inputs[7], false, 700, kStableMs);
  for (size_t i = 0; i < rack::kSlotCount; ++i)
    assert(rack::decide(inputs[i], CloudStatus::Occupied, 700, kStableMs) ==
           ((i == 0 || i == 7) ? Action::TakeOffRack : Action::None));

  const uint32_t start = std::numeric_limits<uint32_t>::max() - 100;
  Sensor wrap = baseline(false, start);
  assert(rack::settled(wrap, uint32_t(start + 300), kStableMs));
  assert(rack::decide(wrap, CloudStatus::Occupied, uint32_t(start + 300), kStableMs) ==
         Action::TakeOffRack);
}

int main() {
  startupAndDecisionTable();
  debounceAndUnsettledCandidates();
  networkGapGuards();
  currentStateReconciliation();
  independentSlotsAndMillisWrap();
  std::cout << "PASS: startup, decision table, debounce, generation guards, reconciliation, slots, millis wrap\n";
}

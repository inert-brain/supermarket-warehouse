import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLocationSnapshot } from './location/firebase-snapshot.ts';
import { actionForSlot, canDispatch } from './location/core.ts';

function fixture() {
  return { stock: { productID: '001', currentStatus: 'EMPTY', expiresOn: '2026-11-10', description: null }, rackSlots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: null, assignedAt: null, stock: null, isOccupied: null, occupancyUpdatedAt: null })), productBindings: [] };
}
test('maps the version-free connector shape and preserves exact product ID and local expiry day', () => {
  const data = fixture();
  assert.equal(mapLocationSnapshot(data, '001', '2026-11-10').product.expiry, 'valid');
  assert.equal(mapLocationSnapshot(data, '001', '2026-11-11').product.expiry, 'expired');
  assert.throws(() => mapLocationSnapshot(data, '1', '2026-11-10'));
  data.stock = null; assert.equal(mapLocationSnapshot(data, '001', '2026-11-10'), null);
});
test('maps EMPTY awaiting, occupied and reserved bindings with nullable occupancy and no versions', () => {
  for (const currentStatus of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
    const data = fixture();
    data.stock.currentStatus = currentStatus;
    const binding = { slotId: 1, productID: '001', assignedAt: '2026-11-10T00:00:00Z' };
    data.productBindings = [binding];
    data.rackSlots[0] = { ...binding, isOccupied: currentStatus === 'OCCUPIED', occupancyUpdatedAt: '2026-11-10T00:00:00Z', stock: { productID: '001', currentStatus } };
    const snapshot = mapLocationSnapshot(data, '001', '2026-11-10');
    assert.deepEqual(snapshot.product, { productID: '001', status: currentStatus, expiry: 'valid' });
    assert.deepEqual(snapshot.slots[0], { ...binding, status: currentStatus, isOccupied: currentStatus === 'OCCUPIED', occupancyUpdatedAt: '2026-11-10T00:00:00Z' });
    data.productBindings = [{ ...binding, assignedAt: 'different time' }];
    assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  }
});
test('requires explicit nullable sensor fields and preserves unknown occupancy while allowing demo selection', () => {
  const data = fixture();
  const snapshot = mapLocationSnapshot(data, '001', '2026-11-10');
  assert.equal(snapshot.slots[0].isOccupied, null);
  assert.equal(snapshot.slots[0].occupancyUpdatedAt, null);
  assert.equal(actionForSlot(snapshot, 1), 'AssignProductToSlot');
  delete data.rackSlots[0].isOccupied;
  assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  data.rackSlots[0].isOccupied = false;
  delete data.rackSlots[0].occupancyUpdatedAt;
  assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
});

test('maps relaxed unassigned stocks and sensor/status disagreements without discarding saved observations', () => {
  for (const currentStatus of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
    const data = fixture(); data.stock.currentStatus = currentStatus;
    assert.equal(actionForSlot(mapLocationSnapshot(data, '001', '2026-11-10'), 1), 'AssignProductToSlot');
    const binding = { slotId: 3, productID: '001', assignedAt: '2026-11-10T00:00:00Z' };
    data.productBindings = [binding];
    for (const isOccupied of [true, false, null]) for (const occupancyUpdatedAt of [null, '2000-01-01T00:00:00Z']) {
      data.rackSlots[2] = { ...binding, isOccupied, occupancyUpdatedAt, stock: { productID: '001', currentStatus } };
      const snapshot = mapLocationSnapshot(data, '001', '2026-11-10');
      assert.equal(snapshot.slots[2].isOccupied, isOccupied);
      assert.equal(snapshot.slots[2].occupancyUpdatedAt, occupancyUpdatedAt);
      assert.equal(actionForSlot(snapshot, 1), isOccupied === true ? null : 'ChangeAssignedSlot');
      assert.equal(canDispatch(snapshot), isOccupied !== true);
    }
  }
});

test('rejects missing slots, unexpected bindings and mismatched joins', () => {
  let data = fixture(); data.rackSlots.pop(); assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  data = fixture(); data.productBindings.push({ slotId: 9, productID: '001', assignedAt: 'now' }); assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  data = fixture(); data.rackSlots[0] = { slotId: 1, productID: 'x', assignedAt: 'now', stock: { productID: 'y', currentStatus: 'OCCUPIED' } }; assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
});

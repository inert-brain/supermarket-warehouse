import test from 'node:test';
import assert from 'node:assert/strict';
import { actionForSlot, makeCommand, transitionEffects, validateSnapshot } from './location/core.ts';

function snapshot(status = 'EMPTY', expiry = 'valid') {
  return { product: { productID: '001', status, expiry }, slots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: i === 0 && status !== 'EMPTY' ? '001' : null, assignedAt: i === 0 && status !== 'EMPTY' ? '2026-01-01' : null, status: i === 0 && status !== 'EMPTY' ? status : null })) };
}
test('transition matrix retains historical event distinction and warehouse effects', () => {
  assert.deepEqual(Object.values(transitionEffects).map(x => [x.to, x.activity, x.warehouse]), [
    ['OCCUPIED', 'ON_RACK', 1], ['PENDING_DISPATCH', 'OFF_RACK', 0], ['OCCUPIED', 'ON_RACK', 0],
    ['OCCUPIED', 'ON_RACK', 0], ['EMPTY', 'DISPATCHED', -1], ['unchanged', 'REMOVED', 0],
  ]);
});
test('slot selection maps placement, return, move and same-slot no-op', () => {
  assert.equal(actionForSlot(snapshot(), 1), 'PlaceProduct');
  assert.equal(actionForSlot(snapshot('OCCUPIED'), 1), null);
  assert.equal(actionForSlot(snapshot('OCCUPIED'), 2), 'MoveProduct');
  assert.equal(actionForSlot(snapshot('PENDING_DISPATCH'), 1), 'ReturnProduct');
  assert.equal(actionForSlot(snapshot('PENDING_DISPATCH'), 2), 'MoveProduct');
  const occupied = snapshot('OCCUPIED');
  occupied.slots[1] = { slotId: 2, productID: 'other', assignedAt: 'now', status: 'OCCUPIED' };
  assert.equal(actionForSlot(occupied, 2), null);
});
test('commands contain only action, product ID, and flat source/target IDs', () => {
  for (const [state, action, target, sourceSlotID, targetSlotID] of [
    ['EMPTY', 'PlaceProduct', 2, null, 2],
    ['OCCUPIED', 'TakeOffRack', undefined, 1, null],
    ['PENDING_DISPATCH', 'ReturnProduct', 1, 1, null],
    ['PENDING_DISPATCH', 'MoveProduct', 2, 1, 2],
    ['PENDING_DISPATCH', 'DispatchProduct', undefined, 1, null],
  ]) assert.deepEqual(makeCommand(snapshot(state), action, target), { action, productID: '001', sourceSlotID, targetSlotID });
  for (const state of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
    assert.deepEqual(makeCommand(snapshot(state, 'expired'), 'RecordExpiredScan'), { action: 'RecordExpiredScan', productID: '001', sourceSlotID: state === 'EMPTY' ? null : 1, targetSlotID: null });
  }
});
test('commands enforce expiry and status without concurrency versions', () => {
  for (const expiry of ['valid', 'expired', 'unknown']) {
    assert.equal(makeCommand(snapshot('OCCUPIED', expiry), 'TakeOffRack').sourceSlotID, 1);
    assert.throws(() => makeCommand(snapshot('PENDING_DISPATCH', expiry), 'TakeOffRack'));
    assert.throws(() => makeCommand(snapshot('EMPTY', expiry), 'TakeOffRack'));
  }
  for (const expiry of ['expired', 'unknown']) {
    assert.throws(() => makeCommand(snapshot('EMPTY', expiry), 'PlaceProduct', 1));
    assert.throws(() => makeCommand(snapshot('OCCUPIED', expiry), 'MoveProduct', 2));
    assert.throws(() => makeCommand(snapshot('PENDING_DISPATCH', expiry), 'ReturnProduct', 1));
    assert.throws(() => makeCommand(snapshot('PENDING_DISPATCH', expiry), 'DispatchProduct'));
  }
  assert.throws(() => makeCommand(snapshot(), 'RecordExpiredScan'));
  assert.throws(() => makeCommand(snapshot('OCCUPIED'), 'MoveProduct', 1));
});
test('invalid or inconsistent snapshots fail closed', () => {
  const missing = snapshot('OCCUPIED'); missing.slots[0].productID = null;
  assert.throws(() => validateSnapshot(missing, '001'));
  const duplicate = snapshot(); duplicate.slots[1].slotId = 1;
  assert.throws(() => validateSnapshot(duplicate, '001'));
  const outOfRange = snapshot(); outOfRange.slots[0].slotId = 9;
  assert.throws(() => validateSnapshot(outOfRange, '001'));
  const mismatch = snapshot('PENDING_DISPATCH'); mismatch.slots[0].status = 'OCCUPIED';
  assert.throws(() => validateSnapshot(mismatch, '001'));
  const extraBinding = snapshot('OCCUPIED'); extraBinding.slots[1] = { ...extraBinding.slots[0], slotId: 2 };
  assert.throws(() => validateSnapshot(extraBinding, '001'));
  assert.throws(() => validateSnapshot(snapshot(), '1'));
});

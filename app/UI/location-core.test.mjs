import test from 'node:test';
import assert from 'node:assert/strict';
import { actionForSlot, makeCommand, transitionEffects, validateSnapshot } from './location/core.ts';

function snapshot(status = 'EMPTY', expiry = 'valid') {
  return { product: { productID: '001', status, version: 4, expiry }, slots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: i === 0 && status !== 'EMPTY' ? '001' : null, assignedAt: i === 0 && status !== 'EMPTY' ? '2026-01-01' : null, version: i, status: i === 0 && status !== 'EMPTY' ? status : null })) };
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
});
test('commands capture versions and enforce expiry and status', () => {
  assert.deepEqual(makeCommand(snapshot('PENDING_DISPATCH'), 'MoveProduct', 'id', 2), { operationID: 'id', action: 'MoveProduct', productID: '001', productVersion: 4, source: { slotId: 1, version: 0 }, target: { slotId: 2, version: 1 } });
  assert.equal(makeCommand(snapshot('OCCUPIED', 'expired'), 'TakeOffRack', 'id').source.slotId, 1);
  assert.throws(() => makeCommand(snapshot('PENDING_DISPATCH', 'expired'), 'DispatchProduct', 'id'));
  assert.throws(() => makeCommand(snapshot('EMPTY', 'unknown'), 'PlaceProduct', 'id', 1));
  assert.equal(makeCommand(snapshot('OCCUPIED', 'expired'), 'RecordExpiredScan', 'id').source.slotId, 1);
  assert.throws(() => makeCommand(snapshot(), 'RecordExpiredScan', 'id'));
});
test('invalid or inconsistent snapshots fail closed', () => {
  const missing = snapshot('OCCUPIED'); missing.slots[0].productID = null;
  assert.throws(() => validateSnapshot(missing, '001'));
  const duplicate = snapshot(); duplicate.slots[1].slotId = 1;
  assert.throws(() => validateSnapshot(duplicate, '001'));
  const badVersion = snapshot(); badVersion.slots[0].version = -1;
  assert.throws(() => validateSnapshot(badVersion, '001'));
  const mismatch = snapshot('PENDING_DISPATCH'); mismatch.slots[0].status = 'OCCUPIED';
  assert.throws(() => validateSnapshot(mismatch, '001'));
  assert.throws(() => validateSnapshot(snapshot(), '1'));
});

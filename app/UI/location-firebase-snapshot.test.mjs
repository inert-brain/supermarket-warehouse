import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLocationSnapshot } from './location/firebase-snapshot.ts';

function fixture() {
  return { stock: { productID: '001', currentStatus: 'EMPTY', expiresOn: '2026-11-10', description: null }, rackSlots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: null, assignedAt: null, stock: null })), productBindings: [] };
}
test('maps the version-free connector shape and preserves exact product ID and local expiry day', () => {
  const data = fixture();
  assert.equal(mapLocationSnapshot(data, '001', '2026-11-10').product.expiry, 'valid');
  assert.equal(mapLocationSnapshot(data, '001', '2026-11-11').product.expiry, 'expired');
  assert.throws(() => mapLocationSnapshot(data, '1', '2026-11-10'));
  data.stock = null; assert.equal(mapLocationSnapshot(data, '001', '2026-11-10'), null);
});
test('maps occupied and reserved bindings without version fields', () => {
  for (const currentStatus of ['OCCUPIED', 'PENDING_DISPATCH']) {
    const data = fixture();
    data.stock.currentStatus = currentStatus;
    const binding = { slotId: 1, productID: '001', assignedAt: '2026-11-10T00:00:00Z' };
    data.productBindings = [binding];
    data.rackSlots[0] = { ...binding, stock: { productID: '001', currentStatus } };
    const snapshot = mapLocationSnapshot(data, '001', '2026-11-10');
    assert.deepEqual(snapshot.product, { productID: '001', status: currentStatus, expiry: 'valid' });
    assert.deepEqual(snapshot.slots[0], { ...binding, status: currentStatus });
    data.productBindings = [{ ...binding, assignedAt: 'different time' }];
    assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  }
});
test('rejects missing slots, unexpected bindings and mismatched joins', () => {
  let data = fixture(); data.rackSlots.pop(); assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  data = fixture(); data.productBindings.push({ slotId: 9, productID: '001', assignedAt: 'now' }); assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
  data = fixture(); data.rackSlots[0] = { slotId: 1, productID: 'x', assignedAt: 'now', stock: { productID: 'y', currentStatus: 'OCCUPIED' } }; assert.throws(() => mapLocationSnapshot(data, '001', '2026-11-10'));
});

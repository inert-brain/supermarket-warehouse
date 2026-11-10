import assert from 'node:assert/strict';
import test from 'node:test';
import { slotGrid } from './slot-picker-core.ts';

test('missing and duplicate slots fail closed in a fixed eight-slot grid', () => {
  const slots = slotGrid([
    { slotId: 1, productID: null, state: 'available' },
    { slotId: 2, productID: null, state: 'available' },
    { slotId: 2, productID: null, state: 'available' },
  ]);
  assert.equal(slots.length, 8);
  assert.equal(slots[0].state, 'available');
  assert.ok(slots.slice(1).every(slot => slot.state === 'unknown'));
});

test('assignment alone is not availability and inconsistent data fails closed', () => {
  const slots = slotGrid([
    { slotId: 1, productID: null, state: 'unknown' },
    { slotId: 2, productID: 'box', state: 'available' },
    { slotId: 3, productID: 'box', state: 'occupied' },
    { slotId: 4, productID: null, state: 'reserved' },
    { slotId: 5, productID: 'box', state: 'removal_pending' },
    { slotId: 6, productID: null, state: 'unrecognized' },
  ]);
  assert.deepEqual(slots.map(slot => slot.state), [
    'unknown', 'unknown', 'occupied', 'reserved', 'removal_pending', 'unknown', 'unknown', 'unknown',
  ]);
  assert.equal(slots[2].productID, 'box');
});

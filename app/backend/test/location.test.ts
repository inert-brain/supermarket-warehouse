import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseCommand } from '../src/location';

const base = { operationID: 'df04d58a-4da0-45f5-acbe-9a274e2e9a01', action: 'PlaceProduct', productID: ' 001 ', productVersion: 0, source: null, target: { slotId: 1, version: 0 } };
test('command validation accepts exact UI shape without changing identity', () => {
  assert.deepEqual(parseCommand(base), base);
  assert.ok(parseCommand({ ...base, action: 'RecordExpiredScan', source: { slotId: 2, version: 5 }, target: null }));
  assert.ok(parseCommand({ ...base, action: 'ReturnProduct', source: { slotId: 2, version: 5 }, target: null }));
});
test('command validation rejects malformed or untrusted fields', () => {
  for (const value of [ { ...base, operationID: 'bad' }, { ...base, productVersion: -1 }, { ...base, productID: ' ' }, { ...base, target: { slotId: 9, version: 0 } }, { ...base, target: { slotId: 1, version: 0, status: 'EMPTY' } }, { ...base, expiry: 'valid' }, { ...base, action: 'MoveProduct', source: { slotId: 1, version: 0 } }, { ...base, action: 'TakeOffRack' } ]) assert.equal(parseCommand(value), null);
});

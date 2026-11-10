import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretStock, localDate, waitForQuery } from './receiving-core.ts';

const barcode = ' 00123 ';
const result = expiresOn => ({ stock: { productID: barcode, description: null, expiresOn } });

test('preserves barcode and applies expiry through the store calendar date', () => {
  assert.equal(interpretStock(result('2026-03-08'), barcode, '2026-03-09').decision, 'EXPIRED');
  assert.equal(interpretStock(result('2026-03-09'), barcode, '2026-03-09').decision, 'READY_FOR_PUTAWAY');
  assert.equal(interpretStock(result('2026-03-10'), barcode, '2026-03-09').decision, 'READY_FOR_PUTAWAY');
  assert.equal(interpretStock(result('2026-03-10'), barcode, '2026-03-09').product.productID, barcode);
});

test('missing or invalid expiry never permits acceptance', () => {
  for (const date of [null, '', '2026-02-29', '0000-01-01', '2026-13-01']) {
    assert.equal(interpretStock(result(date), barcode, '2026-03-09').decision, 'EXPIRY_UNKNOWN');
  }
  assert.equal(interpretStock(result('2024-02-29'), barcode, '2024-02-29').decision, 'READY_FOR_PUTAWAY');
});

test('rejects missing products and malformed or mismatched responses', () => {
  assert.throws(() => interpretStock({ stock: null }, barcode, '2026-03-09'), /not found/i);
  for (const value of [{}, { stock: undefined }, { stock: { productID: '00123', description: null, expiresOn: null } }, { stock: { productID: barcode, expiresOn: null } }]) {
    assert.throws(() => interpretStock(value, barcode, '2026-03-09'), /unexpected/i);
  }
  assert.throws(() => interpretStock(result(null), barcode, 'invalid'), /phone date/i);
});

test('cancellation stops waiting and ignores a late result', async () => {
  const controller = new AbortController();
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const waiting = waitForQuery(pending, controller.signal);
  controller.abort();
  await assert.rejects(waiting, /cancelled/i);
  finish('late');
  assert.equal(await waitForQuery(Promise.resolve('ok'), new AbortController().signal), 'ok');
  await assert.rejects(waitForQuery(Promise.resolve('late'), controller.signal), /cancelled/i);
});

test('uses the phone local calendar date without timezone configuration', () => {
  assert.equal(localDate(new Date(2026, 2, 9, 23, 59)), '2026-03-09');
  assert.equal(localDate(new Date(2026, 2, 10, 0, 1)), '2026-03-10');
  assert.throws(() => localDate(new Date(NaN)), /phone date/i);
});

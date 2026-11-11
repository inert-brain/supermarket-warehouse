import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupOrRegister } from './receiving-core.ts';

const barcode = ' 001234567890 ';
const today = () => '2026-11-11';
const stock = (description = null, expiresOn = null) => ({ stock: { productID: barcode, description, expiresOn } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function fixture(responses, registration = { registration: 1 }) {
  const calls = [];
  const client = {
    async lookup(id) { calls.push(['lookup', id]); const value = responses.shift(); if (value instanceof Error) throw value; return value; },
    async register(id) { calls.push(['register', id]); if (registration instanceof Error) throw registration; return registration; },
  };
  const controller = new AbortController();
  return { calls, client, controller, run: () => lookupOrRegister(barcode, controller.signal, client, today) };
}

test('existing stock is interpreted without a mutation or second read', async () => {
  const f = fixture([stock('Existing description', '2026-11-12')]);
  const result = await f.run();
  assert.equal(result.registered, false);
  assert.equal(result.decision, 'READY_FOR_PUTAWAY');
  assert.equal(result.product.description, 'Existing description');
  assert.deepEqual(f.calls, [['lookup', barcode]]);
});

test('explicit null registers once and rereads, preserving exact barcode and unknown expiry', async () => {
  const f = fixture([{ stock: null }, stock()]);
  const result = await f.run();
  assert.deepEqual(f.calls, [['lookup', barcode], ['register', barcode], ['lookup', barcode]]);
  assert.deepEqual(result, { registered: true, decision: 'EXPIRY_UNKNOWN', product: { productID: barcode, description: null, expiresOn: null } });
});

test('conflict count zero rereads the winner without claiming creation or replacing fields', async () => {
  const f = fixture([{ stock: null }, stock('Concurrent stock', '2026-11-10')], { registration: 0 });
  const result = await f.run();
  assert.equal(result.registered, false);
  assert.equal(result.product.description, 'Concurrent stock');
  assert.equal(result.decision, 'EXPIRED');
  assert.equal(f.calls.length, 3);
});

test('failed or malformed lookups never register', async () => {
  for (const response of [new Error('offline'), null, undefined, [], {}, { stock: undefined }, { stock: false },
    { stock: {} }, { stock: { productID: '001234567890', description: null, expiresOn: null } },
    { stock: { productID: barcode, expiresOn: null } }]) {
    const f = fixture([response]);
    await assert.rejects(f.run());
    assert.deepEqual(f.calls, [['lookup', barcode]]);
  }
});

test('invalid registration counts and mutation failures never report success or automatically retry', async () => {
  for (const response of [new Error('lost response'), null, {}, { registration: null }, { registration: '1' }, { registration: true }, { registration: -1 }, { registration: 2 }]) {
    const f = fixture([{ stock: null }, stock()], response);
    await assert.rejects(f.run(), /registration/i);
    assert.deepEqual(f.calls, [['lookup', barcode], ['register', barcode]]);
  }
});

test('reread must succeed with matching stock; no local record is fabricated', async () => {
  for (const response of [new Error('offline'), { stock: null }, {}, { stock: { productID: 'wrong', description: null, expiresOn: null } }]) {
    const f = fixture([{ stock: null }, response]);
    await assert.rejects(f.run());
    assert.equal(f.calls.length, 3);
  }
});

test('retry after an uncertain mutation reads first and does not overwrite an existing record', async () => {
  const f = fixture([{ stock: null }, stock('Already registered')], new Error('response lost'));
  await assert.rejects(f.run(), /may have completed/i);
  const result = await f.run();
  assert.equal(result.registered, false);
  assert.deepEqual(f.calls, [['lookup', barcode], ['register', barcode], ['lookup', barcode]]);
});

test('blank and already cancelled scans do not start any request', async () => {
  const f = fixture([]);
  await assert.rejects(lookupOrRegister('   ', f.controller.signal, f.client, today), /empty/i);
  f.controller.abort();
  await assert.rejects(f.run(), /cancelled/i);
  assert.deepEqual(f.calls, []);
});

test('cancel while reading prevents writes even if missing stock arrives later', async () => {
  const pending = deferred();
  const f = fixture([]);
  f.client.lookup = () => pending.promise;
  const result = f.run();
  f.controller.abort();
  await assert.rejects(result, /cancelled/i);
  pending.resolve({ stock: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.calls, []);
});

test('cancel after lookup resolves but before its continuation prevents registration', async () => {
  const pending = deferred();
  const f = fixture([]);
  f.client.lookup = () => pending.promise;
  const result = f.run();
  pending.resolve({ stock: null });
  f.controller.abort();
  await assert.rejects(result, /cancelled/i);
  assert.deepEqual(f.calls, []);
});

test('cancel during mutation ignores its late result and does not reread or write again', async () => {
  const pending = deferred();
  const f = fixture([{ stock: null }]);
  f.client.register = id => { f.calls.push(['register', id]); return pending.promise; };
  const result = f.run();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 2);
  f.controller.abort();
  await assert.rejects(result, /cancelled/i);
  pending.resolve({ registration: 1 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 2);
});

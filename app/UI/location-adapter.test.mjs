import test from 'node:test';
import assert from 'node:assert/strict';
import { commandValue, createLocationAdapter } from './location/service.ts';

const command = { action: 'PlaceProduct', productID: '001', sourceSlotID: null, targetSlotID: 1 };
function transport(overrides = {}) {
  return { writesEnabled: true, async readSnapshot() { return null; }, async executeCommand() {}, ...overrides };
}
function snapshot() {
  return { product: { productID: '001', status: 'EMPTY', expiry: 'valid' }, slots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: null, assignedAt: null, status: null })) };
}

test('submits once, accepts SDK completion, and has no journal or recovery API', async () => {
  const sent = [];
  const adapter = createLocationAdapter(transport({ async executeCommand(value) { sent.push(value); } }));
  assert.deepEqual(Object.keys(adapter).sort(), ['read', 'submit', 'writesEnabled']);
  assert.deepEqual(await adapter.submit(command), { status: 'committed', message: 'Inventory updated.' });
  assert.deepEqual(sent, [command]);
  assert.equal((await adapter.submit({ action: 'RecordExpiredScan', productID: '001', sourceSlotID: null, targetSlotID: null })).message, 'Expired scan recorded.');
});

test('rejects duplicate taps rather than queueing a second mutation', async () => {
  let finish, calls = 0;
  const adapter = createLocationAdapter(transport({ async executeCommand() { calls++; await new Promise(resolve => { finish = resolve; }); } }));
  const first = adapter.submit(command);
  await assert.rejects(adapter.submit(command), /already in progress/);
  assert.equal(calls, 1);
  finish(); await first;
  await assert.rejects(adapter.submit({ ...command, targetSlotID: 9 }), /Invalid location command/);
});

test('timeouts release busy state, do not resend, and do not let a late response unlock another action', async () => {
  const completions = []; let calls = 0;
  const adapter = createLocationAdapter(transport({ async executeCommand() {
    calls++; await new Promise(resolve => { completions.push(resolve); });
  } }), 20);
  await assert.rejects(adapter.submit(command), /timed out/);
  assert.equal(calls, 1);
  const next = adapter.submit(command);
  await new Promise(resolve => setImmediate(resolve));
  completions[0]();
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(adapter.submit(command), /already in progress/);
  completions[1](); await next;
  assert.equal(calls, 2);
});

test('lost responses and business rejections are surfaced without retry or permanently blocking new actions', async () => {
  let calls = 0;
  const adapter = createLocationAdapter(transport({ async executeCommand() { calls++; throw new Error('Check failed or response lost'); } }));
  await assert.rejects(adapter.submit(command), /response lost/);
  assert.equal(calls, 1);
  assert.deepEqual(await adapter.read('001', new AbortController().signal), null);
  await assert.rejects(adapter.submit(command), /response lost/);
  assert.equal(calls, 2);
});

test('disabled writes never call the cloud', async () => {
  let calls = 0;
  const adapter = createLocationAdapter(transport({ writesEnabled: false, async executeCommand() { calls++; } }));
  await assert.rejects(adapter.submit(command), /unavailable/);
  assert.equal(calls, 0);
});

test('reads time out and support cancellation including before a request starts', async () => {
  let calls = 0;
  const adapter = createLocationAdapter(transport({ async readSnapshot() { calls++; return new Promise(() => {}); } }), 20);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(adapter.read('001', controller.signal), /cancelled/);
  assert.equal(calls, 0);
  const other = new AbortController(); const reading = adapter.read('001', other.signal); other.abort();
  await assert.rejects(reading, /cancelled/);
  await assert.rejects(adapter.read('001', new AbortController().signal), /timed out/);
});

test('snapshot validation retries once without inventing slots or requiring versions', async () => {
  let value = snapshot(), calls = 0;
  const adapter = createLocationAdapter(transport({ async readSnapshot() { calls++; return value; } }));
  assert.deepEqual(await adapter.read('001', new AbortController().signal), value);
  value = { ...value, slots: value.slots.slice(0, 7) };
  await assert.rejects(adapter.read('001', new AbortController().signal)); assert.equal(calls, 3);
});

test('command validation rejects extra metadata and invalid source/target shapes', () => {
  assert.deepEqual(commandValue(command), command);
  for (const value of [
    { ...command, operationID: 'old-id' }, { ...command, productVersion: 0 },
    { ...command, sourceSlotID: 1 }, { ...command, targetSlotID: null },
    { ...command, targetSlotID: 1.5 }, { ...command, productID: '' },
    { ...command, action: 'Other' }, { ...command, action: 'MoveProduct', sourceSlotID: 1 },
    { ...command, action: 'TakeOffRack' }, { ...command, action: 'RecordExpiredScan' },
  ]) assert.throws(() => commandValue(value), /Invalid location command/);
});

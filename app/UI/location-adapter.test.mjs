import test from 'node:test';
import assert from 'node:assert/strict';
import { commandValue, createLocationAdapter, refreshCommand } from './location/service.ts';

const command = { action: 'AssignProductToSlot', containerID: '001', sourceSlotID: null, targetSlotID: 1 };
function transport(overrides = {}) {
  return { writesEnabled: true, async readSnapshot() { return null; }, async executeCommand() {}, ...overrides };
}
function snapshot() {
  return { product: { containerID: '001', status: 'EMPTY', expiry: 'valid' }, slots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, containerID: null, assignedAt: null, status: null, isOccupied: false, occupancyUpdatedAt: new Date().toISOString() })) };
}

test('submits once, accepts SDK completion, and has no journal or recovery API', async () => {
  const sent = [];
  const adapter = createLocationAdapter(transport({ async executeCommand(value) { sent.push(value); } }));
  assert.deepEqual(Object.keys(adapter).sort(), ['read', 'submit', 'writesEnabled']);
  assert.deepEqual(await adapter.submit(command), { status: 'committed', message: 'Assignment saved. Put the product in Slot 1. Stock changes only when the rack detects the product.' });
  assert.deepEqual(sent, [command]);
  assert.equal((await adapter.submit({ action: 'RecordExpiredScan', containerID: '001', sourceSlotID: null, targetSlotID: null })).message, 'Expired scan recorded. Inventory and slot state unchanged.');
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
    { ...command, targetSlotID: 1.5 }, { ...command, containerID: '' },
    { ...command, action: 'Other' }, { ...command, action: 'ChangeAssignedSlot', sourceSlotID: 1 },
    { ...command, action: 'TakeOffRack' }, { ...command, action: 'RecordExpiredScan' },
  ]) assert.throws(() => commandValue(value), /Invalid location command/);
});

test('preflight accepts old/unknown occupancy but rejects changed bindings and known occupied targets', async () => {
  let value = snapshot(), reads = 0, writes = 0;
  const adapter = createLocationAdapter(transport({
    async readSnapshot() { reads++; return value; },
    async executeCommand() { writes++; },
  }));
  const signal = new AbortController().signal;
  assert.equal(await refreshCommand(adapter, command, signal), value);
  value.slots[0].isOccupied = true;
  await assert.rejects(refreshCommand(adapter, command, signal), /not valid/);
  value.slots[0].isOccupied = false;
  value.slots[0].occupancyUpdatedAt = '2000-01-01T00:00:00Z';
  assert.equal(await refreshCommand(adapter, command, signal), value);
  value.slots[0].isOccupied = null;
  value.slots[0].occupancyUpdatedAt = null;
  assert.equal(await refreshCommand(adapter, command, signal), value);
  value = snapshot();
  value.product.status = 'PENDING_DISPATCH';
  Object.assign(value.slots[0], { containerID: '001', assignedAt: 'now', status: 'PENDING_DISPATCH' });
  const dispatch = { action: 'DispatchProduct', containerID: '001', sourceSlotID: 1, targetSlotID: null };
  assert.equal(await refreshCommand(adapter, dispatch, signal), value);
  Object.assign(value.slots[1], { ...value.slots[0], slotId: 2 });
  Object.assign(value.slots[0], { containerID: null, assignedAt: null, status: null });
  await assert.rejects(refreshCommand(adapter, dispatch, signal), /assignment changed/);
  value.product.status = 'OCCUPIED';
  Object.assign(value.slots[1], { status: 'OCCUPIED', isOccupied: true });
  await assert.rejects(refreshCommand(adapter, { ...dispatch, sourceSlotID: 2 }, signal), /not valid/);
  assert.equal(reads, 7);
  assert.equal(writes, 0);
});

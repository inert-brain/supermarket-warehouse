import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandTransport, mutationForCommand } from './location/firebase-command.ts';
import { createLocationAdapter } from './location/service.ts';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { localDate } from './receiving-core.ts';
import { mapLocationSnapshot } from './location/firebase-snapshot.ts';

const command = (action, sourceSlotID, targetSlotID) => ({ action, productID: ' 001 ', sourceSlotID, targetSlotID });

test('maps exactly the six mutation names with only applicable flat variables', () => {
  for (const [value, extra] of [
    [command('PlaceProduct', null, 2), { targetSlotID: 2 }],
    ...['TakeOffRack', 'ReturnProduct', 'DispatchProduct'].map(action => [command(action, 1, null), { sourceSlotID: 1 }]),
    [command('MoveProduct', 1, 2), { sourceSlotID: 1, targetSlotID: 2 }],
    [command('RecordExpiredScan', 1, null), { sourceSlotID: 1 }],
    [command('RecordExpiredScan', null, null), { sourceSlotID: null }],
  ]) assert.deepEqual(mutationForCommand(value), { name: value.action, variables: { productID: ' 001 ', ...extra } });
});

test('invalid commands never reach Firebase', async () => {
  let calls = 0;
  const transport = createCommandTransport({ async mutate() { calls++; } });
  for (const value of [command('PlaceProduct', 1, 2), command('MoveProduct', 1, 1), command('DispatchProduct', null, null), { ...command('PlaceProduct', null, 1), productVersion: 0 }]) {
    await assert.rejects(transport.executeCommand(value), /Invalid location command/);
  }
  assert.equal(calls, 0);
});

test('direct SDK success needs no operation lookup or response envelope', async () => {
  const calls = [];
  const transport = createCommandTransport({ async mutate(name, variables) { calls.push([name, variables]); return { data: {} }; } });
  assert.deepEqual(Object.keys(transport), ['executeCommand']);
  const adapter = createLocationAdapter({ writesEnabled: true, async readSnapshot() { return null; }, ...transport });
  assert.equal((await adapter.submit(command('MoveProduct', 1, 2))).status, 'committed');
  assert.deepEqual(calls, [['MoveProduct', { productID: ' 001 ', sourceSlotID: 1, targetSlotID: 2 }]]);
});

test('SDK failure is surfaced once without lookup or mutation retry', async () => {
  let calls = 0;
  const failure = new Error('network response lost');
  const transport = createCommandTransport({ async mutate() { calls++; throw failure; } });
  await assert.rejects(transport.executeCommand(command('PlaceProduct', null, 1)), error => error === failure);
  assert.equal(calls, 1);
});

test('Firebase SDK wiring uses server-only snapshots, phone date, and direct mutations without ledger queries', async () => {
  const calls = [], exports = {};
  const data = {
    stock: { productID: ' 001 ', currentStatus: 'EMPTY', expiresOn: '2026-11-10', description: null },
    rackSlots: Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: null, assignedAt: null, stock: null })),
    productBindings: [],
  };
  const modules = {
    'firebase/data-connect': {
      queryRef: (connection, name, variables) => { calls.push(['query', connection, name, variables]); return 'query-ref'; },
      executeQuery: async (ref, options) => { calls.push(['read', ref, options]); return { data }; },
      mutationRef: (connection, name, variables) => { calls.push(['mutation', connection, name, variables]); return 'mutation-ref'; },
      executeMutation: async ref => { calls.push(['write', ref]); return { data: {} }; },
      QueryFetchPolicy: { SERVER_ONLY: 'server-only' },
    },
    '../receiving': { dataConnect: () => 'connection' },
    '../receiving-core': { localDate: () => localDate(new Date(2026, 10, 11, 0, 1)) },
    './firebase-command': { createCommandTransport },
    './firebase-snapshot': { mapLocationSnapshot },
  };
  const source = readFileSync(new URL('./location/firebase-transport.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(js, { exports, require: name => modules[name] });
  const transport = exports.firebaseLocationTransport;
  assert.equal((await transport.readSnapshot(' 001 ')).product.expiry, 'expired');
  await transport.executeCommand(command('PlaceProduct', null, 2));
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['query', 'connection', 'GetLocationSnapshot', { productID: ' 001 ' }],
    ['read', 'query-ref', { fetchPolicy: 'server-only' }],
    ['mutation', 'connection', 'PlaceProduct', { productID: ' 001 ', targetSlotID: 2 }],
    ['write', 'mutation-ref'],
  ]);
});

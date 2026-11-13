import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { lookupOrRegister } from './receiving-core.ts';

const source = readFileSync(new URL('./receiving.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

test('Firebase receiving transport uses server-only reads and the exact registration contract', async () => {
  const calls = [];
  const containerID = ' 000123 ';
  const responses = [{ stock: null }, { stock: { containerID, description: null, expiresOn: null } }];
  const modules = {
    'firebase/app': { getApps: () => [], initializeApp: () => 'app' },
    'firebase/data-connect': {
      getDataConnect: () => 'connection',
      queryRef: (connection, name, variables) => { calls.push(['queryRef', connection, name, variables]); return 'query'; },
      executeQuery: async (ref, options) => { calls.push(['executeQuery', ref, options]); return { data: responses.shift() }; },
      mutationRef: (connection, name, variables) => { calls.push(['mutationRef', connection, name, variables]); return 'mutation'; },
      executeMutation: async ref => { calls.push(['executeMutation', ref]); return { data: { registration: 1 } }; },
      QueryFetchPolicy: { SERVER_ONLY: 'server-only' },
    },
    './receiving-core': { lookupOrRegister },
  };
  const exports = {};
  runInNewContext(js, { exports, require: name => modules[name], process: { env: {
    EXPO_PUBLIC_FIREBASE_API_KEY: 'test', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'test', EXPO_PUBLIC_FIREBASE_APP_ID: 'test',
  } } });
  const result = await exports.validateReceiving(containerID, new AbortController().signal);
  assert.equal(result.registered, true);
  assert.equal(result.decision, 'EXPIRY_UNKNOWN');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['queryRef', 'connection', 'GetStockByProductID', { containerID }],
    ['executeQuery', 'query', { fetchPolicy: 'server-only' }],
    ['mutationRef', 'connection', 'RegisterScannedProduct', { containerID }],
    ['executeMutation', 'mutation'],
    ['queryRef', 'connection', 'GetStockByProductID', { containerID }],
    ['executeQuery', 'query', { fetchPolicy: 'server-only' }],
  ]);
});

test('product scan saves exact barcode text directly without any lookup', async () => {
  const { waitForQuery } = await import('./receiving-core.ts');
  const calls = [];
  let failWrite = false;
  const modules = {
    'firebase/app': { getApps: () => [], initializeApp: () => 'app' },
    'firebase/data-connect': {
      getDataConnect: () => 'connection',
      mutationRef: (_, name, variables) => { calls.push(['mutation', name, variables]); return 'mutation'; },
      executeMutation: async () => { if (failWrite) throw new Error('lost'); return { data: { saved: 1 } }; },
      queryRef: (_, name, variables) => { calls.push(['query', name, variables]); return 'query'; },
      executeQuery: async () => ({ data: { stock: { description: 'P001' } } }),
      QueryFetchPolicy: { SERVER_ONLY: 'server-only' },
    },
    './receiving-core': { waitForQuery },
  };
  const exports = {};
  runInNewContext(js, { exports, require: name => modules[name], process: { env: {
    EXPO_PUBLIC_FIREBASE_API_KEY: 'test', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'test', EXPO_PUBLIC_FIREBASE_APP_ID: 'test',
  } } });
  const signal = new AbortController().signal;
  await exports.saveContainerProduct('BOX-01', 'P001', signal);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['mutation', 'SaveContainerProduct', { containerID: 'BOX-01', productCode: 'P001' }],
  ]);
  calls.length = 0;
  await exports.saveContainerProduct('BOX-01', '  ANY/CODE  ', signal);
  assert.equal(calls[0][2].productCode, '  ANY/CODE  ');
  assert.equal(calls.some(c => c[0] === 'query'), false);
  failWrite = true; calls.length = 0;
  await assert.rejects(exports.saveContainerProduct('BOX-01', 'P001', signal), /may have completed/);
  assert.equal(calls.some(c => c[0] === 'query'), false);
  const abort = new AbortController(); abort.abort(); calls.length = 0;
  await assert.rejects(exports.saveContainerProduct('BOX-01', 'P001', abort.signal), /cancelled/);
  assert.equal(calls.length, 0);
});

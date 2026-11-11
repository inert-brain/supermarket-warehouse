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
  const productID = ' 000123 ';
  const responses = [{ stock: null }, { stock: { productID, description: null, expiresOn: null } }];
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
  const result = await exports.validateReceiving(productID, new AbortController().signal);
  assert.equal(result.registered, true);
  assert.equal(result.decision, 'EXPIRY_UNKNOWN');
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['queryRef', 'connection', 'GetStockByProductID', { productID }],
    ['executeQuery', 'query', { fetchPolicy: 'server-only' }],
    ['mutationRef', 'connection', 'RegisterScannedProduct', { productID }],
    ['executeMutation', 'mutation'],
    ['queryRef', 'connection', 'GetStockByProductID', { productID }],
    ['executeQuery', 'query', { fetchPolicy: 'server-only' }],
  ]);
});

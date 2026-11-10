import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { waitForQuery } from './receiving-core.ts';

function createLoader(execute) {
  const calls = [];
  const exports = {};
  const modules = {
    'firebase/data-connect': {
      queryRef: (...args) => { calls.push(args); return 'ref'; },
      executeQuery: (...args) => { calls.push(args); return execute(); },
      QueryFetchPolicy: { SERVER_ONLY: 'server-only' },
    },
    './receiving-core': { waitForQuery },
    './receiving': { dataConnect: () => 'connection' },
  };
  const source = readFileSync(new URL('./slots.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(js, { exports, require: name => modules[name] });
  return { ...exports, calls };
}

const rows = () => Array.from({ length: 8 }, (_, i) => ({ slotId: i + 1, productID: i === 0 ? '00123' : null }));

test('loads fresh bindings and never treats assignments as physical state', async () => {
  const loader = createLoader(() => Promise.resolve({ data: { slots: rows().reverse() } }));
  const result = await loader.loadSlots(new AbortController().signal);
  assert.equal(JSON.stringify(result), JSON.stringify(rows().map(row => ({ ...row, state: 'unknown' }))));
  assert.equal(JSON.stringify(loader.calls), JSON.stringify([['connection', 'GetSlotBindings', undefined], ['ref', { fetchPolicy: 'server-only' }]]));
});

test('rejects absent, incomplete, duplicate, out-of-range and malformed data', () => {
  const { interpretSlots } = createLoader(() => {});
  for (const data of [null, {}, { slots: null }, { slots: [] },
    { slots: rows().slice(1) },
    { slots: rows().map((row, i) => i === 7 ? { ...row, slotId: 1 } : row) },
    { slots: rows().map((row, i) => i === 7 ? { ...row, slotId: 9 } : row) },
    { slots: rows().map((row, i) => i === 7 ? { ...row, slotId: 1.5 } : row) },
    { slots: rows().map((row, i) => i === 7 ? { slotId: row.slotId } : row) },
    { slots: rows().map((row, i) => i === 7 ? { ...row, productID: 42 } : row) },
  ]) assert.throws(() => interpretSlots(data), /unexpected slot response/i);
});

test('cancellation and query failures never return slot data', async () => {
  let finish;
  const loader = createLoader(() => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController();
  const pending = loader.loadSlots(controller.signal);
  controller.abort();
  await assert.rejects(pending, /cancelled/i);
  finish({ data: { slots: rows() } });
  await assert.rejects(loader.loadSlots(controller.signal), /cancelled/i);
  const failing = createLoader(() => Promise.reject(new Error('offline')));
  await assert.rejects(failing.loadSlots(new AbortController().signal), /could not load slots/i);
});

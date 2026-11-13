import { palette, hardShadow } from './theme.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as core from './location/core.ts';
import { refreshCommand } from './location/service.ts';

const source = readFileSync(new URL('./location/LocationWorkflow.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const fixture = () => ({ product: { containerID: '001', status: 'EMPTY', expiry: 'valid' }, slots: Array.from({ length: 8 }, (_, i) => ({
  slotId: i + 1, containerID: null, assignedAt: null, status: null, isOccupied: false, occupancyUpdatedAt: new Date().toISOString(),
})) });

// Exercise the real component callbacks/effects without adding a native renderer dependency.
// This hook harness is not a replacement for Expo/device acceptance.
function screen(initial = fixture()) {
  const hooks = [], intervals = new Map(), alerts = [], sent = [], busy = [], listeners = new Set();
  let index = 0, dirty = true, effects = [], tree, value = initial, time = Date.now(), reads = 0, fail = false, readFailure = false, mounted = true;
  const changed = (a, b) => !a || a.length !== b.length || a.some((x, i) => x !== b[i]);
  const adapter = {
    writesEnabled: true,
    async read() { reads++; if (readFailure) throw new Error('Network failed. Retry inventory.'); return structuredClone(value); },
    async submit(command) {
      sent.push(command);
      if (fail) throw new Error('response lost');
      return { status: 'committed', message: 'Assignment saved — awaiting placement.' };
    },
  };
  const react = {
    useState(initialValue) {
      const key = index++;
      if (!(key in hooks)) hooks[key] = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [hooks[key], next => {
        const result = typeof next === 'function' ? next(hooks[key]) : next;
        if (hooks[key] !== result) { hooks[key] = result; dirty = true; }
      }];
    },
    useRef(initialValue) { const key = index++; return hooks[key] ??= { current: initialValue }; },
    useCallback(callback, deps) {
      const key = index++;
      if (changed(hooks[key]?.deps, deps)) hooks[key] = { deps, callback };
      return hooks[key].callback;
    },
    useEffect(effect, deps) {
      const key = index++;
      if (changed(hooks[key]?.deps, deps)) {
        const previous = hooks[key];
        hooks[key] = { deps };
        effects.push(() => { previous?.cleanup?.(); hooks[key].cleanup = effect(); });
      }
    },
  };
  const element = (type, props) => ({ type, props });
  const modules = {
    '../theme': { palette, hardShadow },
    '../BrutalButton': { BrutalButton: 'Button' },
    react,
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Button: 'Button', Pressable: 'Pressable', Text: 'Text', View: 'View',
      StyleSheet: { create: value => value }, Alert: { alert: (...args) => alerts.push(args) },
      AppState: { currentState: 'active', addEventListener: (_, callback) => { listeners.add(callback); return { remove: () => listeners.delete(callback) }; } },
    },
    './core': core, './adapter': { locationAdapter: adapter }, './service': { refreshCommand },
  };
  const exports = {};
  class Clock extends Date { static now() { return time; } }
  runInNewContext(js, { exports, require: name => modules[name], AbortController, Error, Date: Clock,
    setInterval: (callback, delay) => { const key = {}; intervals.set(key, { callback, delay }); return key; },
    clearInterval: key => intervals.delete(key),
  });
  const onBusyChange = state => busy.push(state);
  function render() {
    index = 0; dirty = false; effects = [];
    tree = exports.LocationWorkflow({ containerID: initial?.product.containerID ?? '001', adapter, onBusyChange });
    for (const effect of effects) effect();
  }
  async function flush() {
    for (let i = 0; i < 12; i++) {
      if (dirty && mounted) render();
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(item => nodes(item));
    return [node, ...nodes(node.props?.children)];
  }
  return {
    flush, alerts, sent, busy,
    get reads() { return reads; }, get intervals() { return intervals; },
    set value(next) { value = next; }, set fail(next) { fail = next; },
    set readFailure(next) { readFailure = next; },
    buttons: () => nodes(tree).filter(node => node.type === 'Button'),
    slots: () => nodes(tree).filter(node => node.type === 'Pressable'),
    text: () => JSON.stringify(tree),
    async tick(delay, elapsed = delay) {
      time += elapsed;
      for (const item of intervals.values()) if (item.delay === delay) item.callback();
      await flush();
    },
    async appState(state) { for (const listener of listeners) listener(state); await flush(); },
    unmount() { mounted = false; for (const hook of hooks) hook?.cleanup?.(); },
  };
}

test('unassigned WH-PROD-003 immediately gets eight green choices with unreported occupancy', async () => {
  const value = fixture(); value.product.containerID = 'WH-PROD-003';
  value.slots.forEach(slot => { slot.isOccupied = null; slot.occupancyUpdatedAt = null; });
  const ui = screen(value); await ui.flush();
  assert.equal(ui.slots().length, 8);
  assert.equal(ui.slots().every(slot => !slot.props.disabled), true);
  assert.equal(ui.slots().every(slot => slot.props.style({ pressed: false }).some(style => style?.backgroundColor === palette.lime)), true);
  assert.match(ui.text(), /Occupancy unknown/);
  assert.equal(ui.sent.length, 0);
  ui.unmount();
});

test('a product bound to known occupied Slot 3 has no picker or location action regardless of stock or timestamp', async () => {
  for (const status of ['EMPTY', 'PENDING_DISPATCH', 'OCCUPIED']) {
    for (const occupancyUpdatedAt of [null, '2000-01-01T00:00:00Z']) {
      const value = fixture(); value.product.status = status;
      Object.assign(value.slots[2], { containerID: '001', assignedAt: 'now', status, isOccupied: true, occupancyUpdatedAt });
      const ui = screen(value); await ui.flush();
      assert.match(ui.text(), /Already in Slot.*3.*On rack/);
      assert.equal(ui.slots().length, 0);
      assert.deepEqual(ui.buttons().map(button => button.props.title), ['Refresh inventory']);
      assert.equal(ui.sent.length, 0);
      ui.unmount();
    }
  }
});

test('false/null bound and unassigned OCCUPIED stock show picker; reservations and occupied targets stay disabled', async () => {
  for (const expiry of ['valid', 'unknown']) for (const isOccupied of [false, null]) for (const assigned of [false, true]) {
    const value = fixture(); value.product.status = 'OCCUPIED'; value.product.expiry = expiry;
    value.slots.forEach(slot => { slot.occupancyUpdatedAt = '2000-01-01T00:00:00Z'; slot.isOccupied = null; });
    if (assigned) Object.assign(value.slots[2], { containerID: '001', assignedAt: 'now', status: 'OCCUPIED', isOccupied });
    Object.assign(value.slots[3], { containerID: 'other', assignedAt: 'now', status: 'OCCUPIED', isOccupied: false });
    value.slots[4].isOccupied = true;
    const ui = screen(value); await ui.flush();
    assert.equal(ui.slots().length, 8);
    assert.equal(ui.slots()[0].props.disabled, false);
    assert.equal(ui.slots()[2].props.disabled, assigned);
    assert.equal(ui.slots()[3].props.disabled, true);
    assert.equal(ui.slots()[4].props.disabled, true);
    const dispatchReady = assigned;
    assert.equal(/Departure requires/.test(ui.text()), !dispatchReady);
    assert.equal(ui.buttons().find(button => button.props.title.startsWith('Remove Product')).props.disabled, !dispatchReady);
    if (assigned) assert.match(ui.text(), isOccupied === null ? /Occupancy unknown/ : /Off rack/);
    ui.slots()[0].props.onPress(); await ui.flush();
    assert.equal(ui.alerts[0][1].includes('Warning: expiry'), expiry === 'unknown');
    ui.alerts[0][2][1].onPress(); await ui.flush();
    assert.equal(ui.sent.length, 1);
    assert.equal(ui.sent[0].action, assigned ? 'ChangeAssignedSlot' : 'AssignProductToSlot');
    assert.equal(ui.sent[0].sourceSlotID, assigned ? 3 : null);
    assert.equal(ui.sent[0].targetSlotID, 1);
    ui.unmount();
  }
});

test('all stock statuses allow vacant or unknown dispatch and remain explicitly confirmed', async () => {
  for (const expiry of ['valid', 'unknown']) for (const status of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) for (const isOccupied of [false, null]) {
    const value = fixture(); value.product.status = status; value.product.expiry = expiry;
    Object.assign(value.slots[2], { containerID: '001', assignedAt: 'now', status, isOccupied, occupancyUpdatedAt: '2000-01-01T00:00:00Z' });
    const ui = screen(value); await ui.flush();
    const dispatch = ui.buttons().find(button => button.props.title.startsWith('Remove Product'));
    assert.equal(dispatch.props.disabled, false);
    assert.equal(ui.sent.length, 0);
    dispatch.props.onPress(); await ui.flush();
    assert.match(ui.alerts[0][1], /left the warehouse/);
        assert.equal(ui.alerts[0][1].includes('Warning: expiry'), expiry === 'unknown');
    assert.equal(ui.sent.length, 0);
    ui.alerts[0][2][1].onPress(); ui.alerts[0][2][1].onPress(); await ui.flush();
    assert.equal(ui.sent.length, 1);
    assert.equal(ui.sent[0].action, 'DispatchProduct');
    assert.equal(ui.sent[0].sourceSlotID, 3);
    ui.unmount();
  }
});

test('unknown product, missing slot and failed read show retry without inventing a picker or writes', async () => {
  const missingSlot = fixture(); missingSlot.slots.pop();
  for (const value of [null, missingSlot, fixture()]) {
    const ui = screen(value); if (value?.slots.length === 8) ui.readFailure = true;
    await ui.flush();
    assert.equal(ui.slots().length, 0);
    assert.equal(ui.sent.length, 0);
    assert.match(ui.text(), value === null ? /Product not found/ : value.slots.length === 7 ? /Inconsistent inventory/ : /Network failed/);
    const retry = ui.buttons().find(button => button.props.title === 'Retry inventory');
    assert.ok(retry);
    ui.readFailure = false; ui.value = fixture();
    retry.props.onPress(); await ui.flush();
    assert.equal(ui.slots().length, 8);
    ui.unmount();
  }
});

test('expired expiry cannot assign or dispatch with relaxed occupancy', async () => {
  for (const expiry of ['expired']) {
    const value = fixture(); value.product.expiry = expiry;
    Object.assign(value.slots[0], { containerID: '001', assignedAt: 'now', status: 'EMPTY', isOccupied: false });
    const ui = screen(value); await ui.flush();
    assert.equal(ui.slots().every(slot => slot.props.disabled), true);
    assert.equal(ui.buttons().find(button => button.props.title.startsWith('Remove Product')).props.disabled, true);
    assert.equal(ui.sent.length, expiry === 'expired' ? 1 : 0);
    if (expiry === 'expired') assert.equal(ui.sent[0].action, 'RecordExpiredScan');
    ui.unmount();
  }
});

test('screen polls every 5 seconds without aging out occupancy, refreshes foreground and cleans up', async () => {
  const ui = screen(); await ui.flush();
  assert.equal(ui.reads, 1);
  assert.equal(ui.slots().length, 8);
  assert.equal(ui.slots()[0].props.disabled, false);
  await ui.tick(1000, 31_000);
  assert.equal(ui.slots()[0].props.disabled, false);
  assert.equal(ui.intervals.size, 1);
  await ui.tick(5000);
  assert.equal(ui.reads, 2);
  await ui.appState('background');
  await ui.tick(5000);
  assert.equal(ui.reads, 2);
  await ui.appState('active');
  assert.equal(ui.reads, 3);
  ui.unmount();
  assert.equal(ui.intervals.size, 0);
});

test('confirmation rereads before alert and before mutation, does not poll while locked, and refreshes success', async () => {
  const ui = screen(); await ui.flush();
  ui.slots()[1].props.onPress(); ui.slots()[1].props.onPress(); await ui.flush();
  assert.equal(ui.reads, 2);
  assert.equal(ui.alerts.length, 1);
  assert.match(ui.alerts[0][1], /assignment only, not placement or receipt/);
  assert.equal(ui.buttons().every(button => button.props.disabled), true);
  await ui.tick(5000);
  assert.equal(ui.reads, 2);
  ui.alerts[0][2][1].onPress(); await ui.flush();
  assert.equal(ui.reads, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(ui.sent)), [{ action: 'AssignProductToSlot', containerID: '001', sourceSlotID: null, targetSlotID: 2 }]);
  assert.match(ui.text(), /Assignment saved/);
  assert.equal(ui.busy.at(-1), false);
  ui.unmount();
});

test('sensor update during confirmation prevents command, own awaiting slot is no-op, background invalidates alert', async () => {
  const ui = screen(); await ui.flush();
  ui.slots()[0].props.onPress(); await ui.flush();
  const changed = fixture(); changed.slots[0].isOccupied = true; ui.value = changed;
  ui.alerts[0][2][1].onPress(); await ui.flush();
  assert.equal(ui.sent.length, 0);
  assert.match(ui.text(), /No command was sent/);
  Object.assign(changed.slots[0], { containerID: '001', assignedAt: 'now', status: 'EMPTY', isOccupied: false });
  ui.value = changed;
  await ui.tick(5000);
  assert.equal(ui.slots()[0].props.disabled, true);
  assert.match(ui.text(), /Keep current slot \(no change\)/);
  ui.slots()[1].props.onPress(); await ui.flush();
  await ui.appState('background');
  ui.alerts[1][2][1].onPress(); await ui.flush();
  assert.equal(ui.sent.length, 0);
  assert.equal(ui.busy.at(-1), false);
  ui.unmount();
});

test('sensor return without rescan disables dispatch and exposes no manual take-off or return', async () => {
  const value = fixture(); value.product.status = 'PENDING_DISPATCH';
  Object.assign(value.slots[0], { containerID: '001', assignedAt: 'now', status: 'PENDING_DISPATCH' });
  const ui = screen(value); await ui.flush();
  const dispatch = () => ui.buttons().find(button => button.props.title.startsWith('Remove Product'));
  assert.equal(dispatch().props.disabled, false);
  assert.equal(ui.buttons().some(button => /Take off|Return/.test(button.props.title)), false);
  value.product.status = 'OCCUPIED'; Object.assign(value.slots[0], { status: 'OCCUPIED', isOccupied: true });
  ui.value = value; await ui.tick(5000);
  assert.equal(dispatch(), undefined);
  assert.equal(ui.slots().length, 0);
  assert.match(ui.text(), /Already in Slot/);
  assert.match(ui.text(), /Stock: .*OCCUPIED/);
  assert.equal(ui.sent.length, 0);
  ui.unmount();
});

test('lost response warning survives polling and foreground refresh without mutation retry', async () => {
  const ui = screen(); ui.fail = true; await ui.flush();
  ui.slots()[0].props.onPress(); await ui.flush();
  ui.alerts[0][2][1].onPress(); await ui.flush();
  assert.equal(ui.sent.length, 1);
  assert.match(ui.text(), /Outcome not confirmed/);
  await ui.tick(5000);
  await ui.appState('background'); await ui.appState('active');
  assert.match(ui.text(), /Outcome not confirmed/);
  assert.equal(ui.sent.length, 1);
  ui.unmount();
});

test('expired scan logs once across polling and foreground, including an uncertain response', async () => {
  const value = fixture(); value.product.expiry = 'expired';
  const ui = screen(value); ui.fail = true; await ui.flush();
  assert.equal(ui.sent.length, 1);
  assert.equal(ui.sent[0].action, 'RecordExpiredScan');
  assert.equal(ui.sent[0].sourceSlotID, null);
  await ui.tick(5000);
  await ui.appState('background'); await ui.appState('active');
  assert.equal(ui.sent.length, 1);
  assert.match(ui.text(), /Outcome not confirmed/);
  ui.unmount();
});

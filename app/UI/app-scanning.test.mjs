import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const barcode = ' 00123 ';
const result = registered => ({ registered, decision: 'EXPIRY_UNKNOWN', product: { productID: barcode, description: null, expiresOn: null } });

// Exercise App's real render branches and callbacks without a native renderer.
function screen() {
  const hooks = [], requests = [], alerts = [], timers = new Map();
  let index = 0, dirty = true, tree;
  const getPermission = async () => {};
  const element = (type, props) => ({ type, props });
  const modules = {
    react: {
      useState(initial) {
        const key = index++;
        if (!(key in hooks)) hooks[key] = initial;
        return [hooks[key], value => { hooks[key] = value; dirty = true; }];
      },
      useRef(initial) { const key = index++; return hooks[key] ??= { current: initial }; },
      useEffect(effect, deps) {
        const key = index++;
        if (!hooks[key] || deps.some((dep, i) => dep !== hooks[key].deps[i])) {
          hooks[key]?.cleanup?.();
          hooks[key] = { deps, cleanup: effect() };
        }
      },
    },
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [{ granted: true }, async () => {}, getPermission] },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'react-native': {
      ActivityIndicator: 'ActivityIndicator', Button: 'Button', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
      Alert: { alert: (...args) => alerts.push(args) },
            StyleSheet: { create: value => value }, AppState: { addEventListener: () => ({ remove() {} }) },
    },
    './receiving': { validateReceiving: (id, signal) => new Promise((resolve, reject) => requests.push({ id, signal, resolve, reject })) },
    './location/LocationWorkflow': { LocationWorkflow: 'LocationWorkflow' },
  };
  const exports = {};
  runInNewContext(js, {
    exports, require: name => modules[name], AbortController, Error,
    setTimeout: callback => { const key = {}; timers.set(key, callback); return key; },
    clearTimeout: key => timers.delete(key),
  });
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children)];
  }
  function render() { index = 0; dirty = false; tree = exports.default(); }
  render();
  const find = type => nodes(tree).filter(node => node.type === type);
  return {
    requests, alerts, find,
    scan() { find('Camera')[0].props.onBarcodeScanned({ data: barcode }); },
    button(title) { return find('Button').find(node => node.props.title === title).props.onPress(); },
    text: () => JSON.stringify(tree),
    timeout() { for (const callback of timers.values()) callback(); },
    async flush() {
      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setImmediate(resolve));
        if (dirty) render();
      }
    },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); },
  };
}

test('retail formats are configured and duplicate scans are locked', async () => {
  const ui = screen();
  assert.deepEqual(Array.from(ui.find('Camera')[0].props.barcodeScannerSettings.barcodeTypes), ['code128', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39']);
  ui.scan(); ui.scan(); await ui.flush();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].id, barcode);
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.unmount();
});

test('location mounts only after successful receiving flow and creation message uses result flag', async () => {
  for (const registered of [true, false]) {
    const ui = screen(); ui.scan(); await ui.flush();
    assert.equal(ui.find('LocationWorkflow').length, 0);
    ui.requests[0].resolve(result(registered)); await ui.flush();
    assert.equal(ui.find('LocationWorkflow').length, 1);
    assert.equal(ui.find('LocationWorkflow')[0].props.productID, barcode);
    assert.equal(ui.text().includes('New product registered.'), registered);
    assert.match(ui.text(), /Expiry unknown/);
    ui.unmount();
  }
});

test('failed lookup and retry keep location unmounted', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  ui.requests[0].reject(new Error('Lookup failed')); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.button('Retry lookup'); await ui.flush();
  assert.equal(ui.requests.length, 2);
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.requests[1].resolve(result(false)); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 1);
  ui.unmount();
});

test('scan again cancels the previous flow and ignores late success', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  ui.button('Scan again'); await ui.flush();
  assert.equal(ui.requests[0].signal.aborted, true);
  ui.requests[0].resolve(result(true)); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  assert.equal(ui.text().includes('New product registered.'), false);
    assert.equal(ui.alerts.length, 0);
  ui.unmount();
});

test('timeout warns about uncertain registration and never mounts location on late success', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  ui.timeout();
  ui.requests[0].reject(new Error('Lookup cancelled.')); await ui.flush();
  assert.match(ui.text(), /Registration may have completed/);
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.unmount();
});

test('unknown expiry warns once per deliberate scan without blocking or changing the decision', async () => {
  const ui = screen(); ui.scan(); ui.scan(); await ui.flush();
  ui.requests[0].resolve(result(false)); await ui.flush();
  assert.equal(ui.alerts.length, 1);
  assert.equal(ui.alerts[0][0], 'Expiry unknown');
  assert.match(ui.alerts[0][1], /You can continue/);
  assert.match(ui.text(), /EXPIRY_UNKNOWN/);
  assert.match(ui.text(), /warning only/);
  assert.equal(ui.find('LocationWorkflow').length, 1);
  await ui.flush();
  assert.equal(ui.alerts.length, 1);
  ui.button('Scan again'); await ui.flush();
  ui.scan(); await ui.flush();
  ui.requests[1].resolve(result(true)); await ui.flush();
  assert.equal(ui.alerts.length, 2);
  ui.unmount();
});

test('valid and expired lookups do not show the unknown-expiry warning', async () => {
  for (const decision of ['READY_FOR_PUTAWAY', 'EXPIRED']) {
    const ui = screen(); ui.scan(); await ui.flush();
    ui.requests[0].resolve({ ...result(false), decision }); await ui.flush();
    assert.equal(ui.alerts.length, 0);
    if (decision === 'EXPIRED') assert.match(ui.text(), /Expired: do not receive/);
    ui.unmount();
  }
});

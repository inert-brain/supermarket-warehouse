import { palette, hardShadow } from './theme.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const barcode = ' 00123 ';
const result = registered => ({ registered, decision: 'EXPIRY_UNKNOWN', product: { containerID: barcode, description: 'P001', expiresOn: null } });

// Exercise App's real render branches and callbacks without a native renderer.
function screen() {
  const hooks = [], requests = [], productRequests = [], alerts = [], timers = new Map();
  let index = 0, dirty = true, tree;
  const getPermission = async () => {};
  const element = (type, props) => ({ type, props });
  const modules = {
    './theme': { palette, hardShadow },
    './BrutalButton': { BrutalButton: 'Button' },
    react: {
      useState(initial) {
        const key = index++;
        if (!(key in hooks)) hooks[key] = initial;
        return [hooks[key], value => { hooks[key] = typeof value === 'function' ? value(hooks[key]) : value; dirty = true; }];
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
    './receiving': { validateReceiving: (id, signal) => new Promise((resolve, reject) => requests.push({ id, signal, resolve, reject })), saveContainerProduct: (id, code, signal) => new Promise((resolve, reject) => productRequests.push({ id, code, signal, resolve, reject })) },
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
    requests, productRequests, alerts, find,
    scan(value = barcode) { find('Camera')[0].props.onBarcodeScanned({ data: value }); },
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
    assert.equal(ui.find('LocationWorkflow')[0].props.containerID, barcode);
    assert.equal(ui.text().includes('New container registered.'), registered);
    assert.doesNotMatch(ui.text(), /Expiry unknown/);
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
  assert.equal(ui.text().includes('New container registered.'), false);
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

test('unknown expiry shows no popup or warning during container scans', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  ui.requests[0].resolve(result(false)); await ui.flush();
  assert.equal(ui.alerts.length, 0);
  assert.doesNotMatch(ui.text(), /Expiry unknown|Expires on|EXPIRY_UNKNOWN/);
  assert.equal(ui.find('LocationWorkflow').length, 1);
  ui.button('Scan again'); await ui.flush();
  ui.scan(); await ui.flush();
  ui.requests[1].resolve(result(true)); await ui.flush();
  assert.equal(ui.alerts.length, 0);
  ui.unmount();
});

test('valid and expired lookups do not show the unknown-expiry warning', async () => {
  for (const decision of ['READY_FOR_PUTAWAY', 'EXPIRED']) {
    const ui = screen(); ui.scan(); await ui.flush();
    ui.requests[0].resolve({ ...result(false), decision }); await ui.flush();
    assert.equal(ui.alerts.length, 0);
    assert.doesNotMatch(ui.text(), /Expired: do not receive|Expires on/);
    ui.unmount();
  }
});


test('new container requires a separate product scan before location actions', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  const empty = result(true); empty.product.description = null;
  ui.requests[0].resolve(empty); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  assert.match(ui.text(), /Scan the product for container/);
  ui.button('Start product scan'); await ui.flush();
  ui.scan('P001'); ui.scan('P001'); await ui.flush();
  assert.equal(ui.productRequests.length, 1);
  assert.equal(ui.productRequests[0].id, barcode);
  assert.equal(ui.productRequests[0].code, 'P001');
  ui.productRequests[0].resolve(); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 1);
  assert.match(ui.text(), /P001/);
  ui.unmount();
});

test('late phase-one camera events preserve the container and route to the product phase', async () => {
  const ui = screen();
  const oldCameraCallback = ui.find('Camera')[0].props.onBarcodeScanned;
  ui.scan(); await ui.flush();
  const empty = result(true); empty.product.description = null;
  ui.requests[0].resolve(empty); await ui.flush();
  assert.match(ui.text(), /02 \/ PREPARE PRODUCT/);
  assert.equal(ui.find('Camera')[0].props.onBarcodeScanned, undefined);
  oldCameraCallback({ data: 'P001' }); await ui.flush();
  assert.equal(ui.productRequests.length, 0);
  ui.button('Start product scan'); await ui.flush();
  assert.match(ui.text(), /02 \/ SCAN THE PRODUCT/);
  oldCameraCallback({ data: barcode }); await ui.flush();
  assert.equal(ui.productRequests.length, 0);
  assert.equal(ui.requests.length, 1);
  oldCameraCallback({ data: 'P001' }); await ui.flush();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.productRequests.length, 1);
  assert.equal(ui.productRequests[0].id, barcode);
  assert.match(ui.text(), /02 \/ SAVING PRODUCT/);
  assert.doesNotMatch(ui.text(), /01 \/ SCAN A CONTAINER/);
  ui.productRequests[0].reject(new Error('Catalog unavailable')); await ui.flush();
  assert.match(ui.text(), /02 \/ PRODUCT CHECK FAILED/);
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.unmount();
});

test('blank description scans raw text and returns to actions without another lookup', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  const empty = result(false); empty.product.description = '   ';
  ui.requests[0].resolve(empty); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.button('Start product scan'); await ui.flush();
  ui.scan('  BAR/CODE-009  '); await ui.flush();
  assert.equal(ui.productRequests[0].code, '  BAR/CODE-009  ');
  ui.productRequests[0].resolve(); await ui.flush();
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.find('LocationWorkflow').length, 1);
  assert.match(ui.text(), /BAR\/CODE-009/);
  ui.unmount();
});

test('existing description opens actions and canceling a product rescan keeps it', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  ui.requests[0].resolve(result(false)); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 1);
  ui.button('Scan product'); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  ui.button('Cancel product scan'); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 1);
  assert.match(ui.text(), /P001/);
  assert.equal(ui.productRequests.length, 0);
  ui.unmount();
});

test('container barcode previously saved as description cannot skip the product step', async () => {
  const ui = screen(); ui.scan(); await ui.flush();
  const corrupted = result(false); corrupted.product.description = barcode.trim();
  ui.requests[0].resolve(corrupted); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 0);
  assert.match(ui.text(), /02 \/ PREPARE PRODUCT/);
  assert.equal(ui.find('Camera')[0].props.onBarcodeScanned, undefined);
  assert.equal(ui.find('Button').some(node => node.props.title === 'Cancel product scan'), false);
  ui.button('Start product scan'); await ui.flush();
  ui.scan(barcode.trim()); await ui.flush();
  assert.equal(ui.productRequests.length, 0);
  ui.scan('DEMO003'); await ui.flush();
  assert.equal(ui.productRequests[0].code, 'DEMO003');
  ui.productRequests[0].resolve(); await ui.flush();
  assert.equal(ui.find('LocationWorkflow').length, 1);
  assert.match(ui.text(), /DEMO003/);
  ui.unmount();
});

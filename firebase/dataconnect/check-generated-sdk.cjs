// Run after SDK generation (including generation performed by emulators:exec).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../app/UI/node_modules/typescript');

for (const file of [
  'example/generated/.guides/usage.md',
  'example/generated/README.md',
  'example/generated/esm/index.esm.js',
  'example/generated/index.cjs.js',
  'example/generated/index.d.ts',
]) {
  const filename = path.join(__dirname, file);
  let text = fs.readFileSync(filename, 'utf8').replace(/[ \t]+$/gm, '');
  if (file.endsWith('.d.ts')) {
    // Data Connect 3.4.25 emits an invalid empty statement after ambient enums.
    text = text.replace(/(export enum \w+ \{[^}]*\n\});/g, '$1');
    assert.doesNotMatch(text, /\b(?:version|operationID|productVersion|sourceVersion|targetVersion|LocationOperation_Key|GetLocationOperationData|PlaceProductData|MoveProductData|TakeOffRackData|ReturnProductData)\b/);
  }
  if (file.endsWith('.js')) assert.doesNotMatch(text, /\bgetLocationOperation(?:Ref)?\b/);
  fs.writeFileSync(filename, text);
}

const program = ts.createProgram([
  path.join(__dirname, 'example/generated/index.d.ts'),
  path.join(__dirname, 'sdk-contract.test.ts'),
], {
  noEmit: true,
  strict: true,
  skipLibCheck: false,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { 'firebase/*': [path.resolve(__dirname, '../../app/UI/node_modules/firebase/*')] },
  types: [],
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => __dirname,
    getCanonicalFileName: filename => filename,
    getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else {
  console.log('Generated SDK: strict TypeScript and occupancy API contracts passed (skipLibCheck=false); obsolete manual mutations absent');
}

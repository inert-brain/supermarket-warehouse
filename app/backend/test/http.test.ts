import { strict as assert } from 'node:assert';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { createHandler } from '../src/http';
import { ProductLookup } from '../src/products';

async function request(lookup: ProductLookup, body: string, method = 'POST', url = '/receiving/validate') {
  const req = Object.assign(Readable.from([Buffer.from(body)]), { method, url }) as IncomingMessage;
  let status = 0;
  let output = '';
  const headers: Record<string, string> = {};
  const res = {
    setHeader(name: string, value: string) { headers[name] = value; },
    writeHead(code: number) { status = code; },
    end(value: string) { output = value; },
  } as unknown as ServerResponse;
  await createHandler(lookup, 'UTC', () => new Date('2026-03-10T12:00:00Z'))(req, res);
  return { status, body: JSON.parse(output), headers };
}

test('endpoint preserves barcode and returns decisions without writes', async () => {
  const calls: string[] = [];
  const lookup: ProductLookup = { async findByBarcode(barcode) {
    calls.push(barcode);
    return { productID: barcode, description: 'Milk', expiresOn: '2026-03-10' };
  } };
  const result = await request(lookup, '{"barcode":" 0012 "}');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { decision: 'READY_FOR_PUTAWAY', product: { productID: ' 0012 ', description: 'Milk', expiresOn: '2026-03-10' } });
  assert.deepEqual(calls, [' 0012 ']);
  const expired = await request({ async findByBarcode() { return { productID: 'x', description: null, expiresOn: '2026-03-09' }; } }, '{"barcode":"x"}');
  assert.equal(expired.body.decision, 'EXPIRED');
  const unknown = await request({ async findByBarcode() { return { productID: 'x', description: null, expiresOn: null }; } }, '{"barcode":"x"}');
  assert.equal(unknown.body.decision, 'EXPIRY_UNKNOWN');
});

test('endpoint rejects bad requests and does not query them', async () => {
  const lookup: ProductLookup = { async findByBarcode() { throw new Error('must not be called'); } };
  for (const body of ['{', '{}', 'null', '[]', '{"barcode":"  "}', '{"barcode":123}']) {
    const result = await request(lookup, body);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'INVALID_INPUT');
  }
  assert.equal((await request(lookup, 'x'.repeat(8193))).status, 413);
  assert.equal((await request(lookup, '', 'GET')).status, 405);
  assert.equal((await request(lookup, '', 'POST', '/other')).status, 404);
});

test('endpoint distinguishes missing product from lookup failure without leaking errors', async () => {
  const missing = await request({ async findByBarcode() { return null; } }, '{"barcode":"0001"}');
  assert.deepEqual(missing.body, { error: 'PRODUCT_NOT_FOUND' });
  assert.equal(missing.status, 404);
  const unavailable = await request({ async findByBarcode() { throw new Error('secret credential'); } }, '{"barcode":"0001"}');
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, { error: 'LOOKUP_UNAVAILABLE' });
});

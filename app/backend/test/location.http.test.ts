import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createHandler } from '../src/http';
import { LocationService } from '../src/location';

test('location HTTP responses distinguish terminal, unresolved, mismatch and failures', async () => {
  const id = 'df04d58a-4da0-45f5-acbe-9a274e2e9a01';
  const command = { operationID: id, action: 'PlaceProduct', productID: 'x', productVersion: 0, source: null, target: { slotId: 1, version: 0 } };
  const location = { async operation() { return null; }, async snapshot() { return null; }, async submit() { return 'mismatch'; } } as unknown as LocationService;
  const server = createServer(createHandler({ async findByBarcode() { return null; } }, 'UTC', undefined, location));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('no address');
    const root = `http://127.0.0.1:${address.port}`;
    const unresolved = await fetch(`${root}/location/operations/${id}`);
    assert.deepEqual(await unresolved.json(), { operationID: id, status: 'unresolved' });
    assert.equal((await fetch(`${root}/location/snapshot?productID=x`)).status, 404);
    assert.equal((await fetch(`${root}/location/snapshot?productID=x&productID=y`)).status, 400);
    const mismatch = await fetch(`${root}/location/commands`, { method: 'POST', body: JSON.stringify(command) });
    assert.equal(mismatch.status, 409); assert.deepEqual(await mismatch.json(), { error: 'OPERATION_ID_MISMATCH' });
    assert.equal((await fetch(`${root}/location/commands`, { method: 'POST', body: '{}' })).status, 400);
    assert.equal((await fetch(`${root}/location/commands`)).status, 405);
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});

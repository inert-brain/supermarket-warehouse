import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DataConnect } from 'firebase-admin/data-connect';
import { createProductLookup } from '../src/products';

test('lookup uses the read-only SDK API and a parameterized primary key', async () => {
  const calls: unknown[][] = [];
  const client = { async executeGraphqlRead(...args: unknown[]) {
    calls.push(args);
    return { data: { stock: { productID: '0001', description: null, expiresOn: '2026-01-01' } } };
  } } as unknown as Pick<DataConnect, 'executeGraphqlRead'>;
  const product = await createProductLookup(client).findByBarcode('0001');
  assert.equal(product?.productID, '0001');
  assert.equal(calls.length, 1);
  assert.match(calls[0][0] as string, /stock\(key: \{ productID: \$productID \}\)/);
  assert.doesNotMatch(calls[0][0] as string, /mutation|0001/i);
  assert.deepEqual(calls[0][1], { variables: { productID: '0001' } });
});

test('lookup handles null but rejects incomplete or mismatched responses', async () => {
  const client = (stock: unknown) => ({ async executeGraphqlRead() { return { data: { stock } }; } }) as unknown as Pick<DataConnect, 'executeGraphqlRead'>;
  assert.equal(await createProductLookup(client(null)).findByBarcode('x'), null);
  await assert.rejects(createProductLookup(client(undefined)).findByBarcode('x'));
  await assert.rejects(createProductLookup(client({ productID: 'wrong', description: null, expiresOn: null })).findByBarcode('x'));
});

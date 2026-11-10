import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { Command, LocationService } from '../src/location';

// This creates and drops a private schema. Only set this to a disposable test database.
const url = process.env.LOCATION_TEST_DATABASE_URL;
test('PostgreSQL transactions, conflicts, rollback, and replay', { skip: !url }, async () => {
  const schema = `location_test_${randomUUID().replace(/-/g, '')}`;
  const admin = new Pool({ connectionString: url });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString: url, options: `-c search_path=${schema}`, max: 10 });
  try {
    await pool.query(`CREATE TABLE stocks (product_id text PRIMARY KEY, current_status text NOT NULL, status_updated_at timestamptz NOT NULL DEFAULT now(), expires_on date, version int NOT NULL DEFAULT 0);
      CREATE TABLE slots (slot_id int PRIMARY KEY, assigned_product_id text UNIQUE REFERENCES stocks(product_id), assigned_at timestamptz, version int NOT NULL DEFAULT 0);
      CREATE TABLE activities (id serial PRIMARY KEY, product_id text NOT NULL REFERENCES stocks(product_id), activity_type text NOT NULL, occurred_at timestamptz NOT NULL);
      CREATE TABLE location_operations (operation_id text PRIMARY KEY, payload jsonb NOT NULL, outcome text NOT NULL, result jsonb NOT NULL, completed_at timestamptz NOT NULL);
      INSERT INTO stocks(product_id,current_status,expires_on) VALUES ('a','EMPTY','2026-03-10'),('b','EMPTY','2026-03-10'),('expired','EMPTY','2026-03-09'),('x','EMPTY','2026-03-10'),('y','EMPTY','2026-03-10');
      INSERT INTO slots(slot_id) SELECT generate_series(1,8)`);
    const service = new LocationService(pool, 'Asia/Manila', () => new Date('2026-03-10T00:00:00Z'));
    const cmd = (action: Command['action'], productID: string, productVersion: number, source: Command['source'], target: Command['target']): Command => ({ operationID: randomUUID(), action, productID, productVersion, source, target });
    // Corruption of an unrelated binding must block even an otherwise valid command.
    await pool.query("UPDATE slots SET assigned_product_id='b', assigned_at=now() WHERE slot_id=8");
    const corrupt = cmd('PlaceProduct', 'a', 0, null, { slotId: 1, version: 0 });
    const rejected = await service.submit(corrupt);
    assert.deepEqual((rejected as any).outcome, { status: 'conflict', message: 'INCONSISTENT_INVENTORY' });
    assert.deepEqual(await service.operation(corrupt.operationID), rejected);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM activities')).rows[0].n, 0);
    assert.equal((await pool.query("SELECT version FROM stocks WHERE product_id='a'")).rows[0].version, 0);
    assert.equal((await pool.query('SELECT assigned_product_id FROM slots WHERE slot_id=1')).rows[0].assigned_product_id, null);
    for (const status of ['OCCUPIED', 'PENDING_DISPATCH']) {
      await pool.query('UPDATE stocks SET current_status=$1 WHERE product_id=$2', [status, 'b']);
      assert.equal((await service.submit(cmd('RecordExpiredScan', 'expired', 0, null, null)) as any).outcome.status, 'committed');
    }
    await pool.query("UPDATE slots SET assigned_product_id=NULL, assigned_at=NULL WHERE slot_id=8; UPDATE stocks SET current_status='EMPTY' WHERE product_id='b'; DELETE FROM activities");
    const a = cmd('PlaceProduct', 'a', 0, null, { slotId: 1, version: 0 });
    const b = cmd('PlaceProduct', 'b', 0, null, { slotId: 1, version: 0 });
    const results = await Promise.all([service.submit(a), service.submit(a)]);
    assert.equal((results[0] as { outcome: { status: string } }).outcome.status, 'committed');
    assert.equal((await service.submit(b) as any).outcome.status, 'conflict');
    assert.deepEqual(results[0], results[1]);
    const contenders = await Promise.all(['x', 'y'].map(id => service.submit(cmd('PlaceProduct', id, 0, null, { slotId: 4, version: 0 }))));
    assert.deepEqual(contenders.map(r => (r as any).outcome.status).sort(), ['committed', 'conflict']);
    const winner = (await pool.query('SELECT assigned_product_id FROM slots WHERE slot_id=4')).rows[0].assigned_product_id as string;
    assert.equal((await service.submit(cmd('TakeOffRack', winner, 1, { slotId: 4, version: 1 }, null)) as any).outcome.status, 'committed');
    const race = await Promise.all([
      service.submit(cmd('MoveProduct', winner, 2, { slotId: 4, version: 2 }, { slotId: 5, version: 0 })),
      service.submit(cmd('DispatchProduct', winner, 2, { slotId: 4, version: 2 }, null)),
    ]);
    assert.deepEqual(race.map(r => (r as any).outcome.status).sort(), ['committed', 'conflict']);
    assert.ok((await pool.query('SELECT count(*)::int AS n FROM slots WHERE assigned_product_id=$1', [winner])).rows[0].n <= 1);
    assert.deepEqual(await service.operation(a.operationID), results[0]);
    assert.equal(await service.submit({ ...a, productID: 'b' }), 'mismatch');
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM activities WHERE product_id='a'")).rows[0].n, 1);
    const take = cmd('TakeOffRack', 'a', 1, { slotId: 1, version: 1 }, null);
    assert.equal((await service.submit(take) as any).outcome.status, 'committed');
    const oldDispatch = cmd('DispatchProduct', 'a', 2, { slotId: 1, version: 2 }, null);
    const ret = cmd('ReturnProduct', 'a', 2, { slotId: 1, version: 2 }, null);
    assert.equal((await service.submit(ret) as any).outcome.status, 'committed');
    assert.equal((await service.submit(cmd('TakeOffRack', 'a', 3, { slotId: 1, version: 3 }, null)) as any).outcome.status, 'committed');
    assert.equal((await service.submit(oldDispatch) as any).outcome.status, 'conflict');
    const move = cmd('MoveProduct', 'a', 4, { slotId: 1, version: 4 }, { slotId: 2, version: 0 });
    assert.equal((await service.submit(move) as any).outcome.status, 'committed');
    assert.equal((await service.submit(cmd('TakeOffRack', 'a', 5, { slotId: 2, version: 1 }, null)) as any).outcome.status, 'committed');
    assert.equal((await service.submit(cmd('DispatchProduct', 'a', 6, { slotId: 2, version: 2 }, null)) as any).outcome.status, 'committed');
    const snapshot: any = await service.snapshot('a');
    assert.equal(snapshot.product.status, 'EMPTY'); assert.equal(snapshot.slots[1].assignedAt, null); assert.equal(snapshot.slots[1].productID, null);
    const before = (await pool.query("SELECT * FROM stocks WHERE product_id='expired'")).rows[0];
    assert.equal((await service.submit(cmd('RecordExpiredScan', 'expired', 0, null, null)) as any).outcome.status, 'committed');
    assert.deepEqual((await pool.query("SELECT * FROM stocks WHERE product_id='expired'")).rows[0], before);
    await pool.query("ALTER TABLE activities ADD CONSTRAINT reject_events CHECK (activity_type <> 'ON_RACK') NOT VALID");
    const fail = cmd('PlaceProduct', 'b', 0, null, { slotId: 3, version: 0 });
    await assert.rejects(service.submit(fail));
    assert.equal(await service.operation(fail.operationID), null);
    assert.equal((await pool.query('SELECT assigned_product_id FROM slots WHERE slot_id=3')).rows[0].assigned_product_id, null);
    assert.equal((await pool.query("SELECT version FROM stocks WHERE product_id='b'")).rows[0].version, 0);
  } finally { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});

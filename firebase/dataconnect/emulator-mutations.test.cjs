// Run only against a fresh, disposable Data Connect emulator database.
const assert = require('node:assert/strict');
const { Client } = require('../../app/backend/node_modules/pg');
const { initializeApp, deleteApp } = require('../../app/UI/node_modules/firebase/app');
const { getDataConnect, connectDataConnectEmulator, mutationRef, executeMutation, queryRef, executeQuery, QueryFetchPolicy } = require('../../app/UI/node_modules/firebase/data-connect');

async function main() {
  if (process.env.LOCATION_TEST_DISPOSABLE !== 'yes') {
    throw new Error('Refusing to modify a database without LOCATION_TEST_DISPOSABLE=yes');
  }
  if (process.env.FIREBASE_DATACONNECT_POSTGRESQL_STRING) {
    throw new Error('Refusing a database override; use the in-memory emulator test config');
  }
  const db = new Client({ host: '127.0.0.1', port: 5432, database: 'smart-warehouse-database', user: 'postgres' });
  await db.connect();
  let app;
  try {
    assert.equal((await db.query('SELECT count(*) FROM stocks')).rows[0].count, '0', 'Use a fresh emulator, not saved development data');
    assert.equal((await db.query('SELECT count(*) FROM slots')).rows[0].count, '0');
    assert.equal((await db.query('SELECT count(*) FROM activities')).rows[0].count, '0');
    assert.deepEqual((await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name IN ('stocks', 'slots') AND column_name = 'version') OR table_name = 'location_operations')")).rows, []);
    // A past expiry deliberately proves that the connector does not enforce expiry.
    await db.query("INSERT INTO stocks (product_id, current_status, status_updated_at, expires_on) VALUES ('test-001', 'EMPTY', '2000-01-01T00:00:00Z', '2000-01-01'), ('blocker', 'OCCUPIED', now(), NULL)");
    await db.query('INSERT INTO slots (slot_id) SELECT generate_series(1,8)');
    await db.query("UPDATE slots SET assigned_product_id = 'blocker', assigned_at = now() WHERE slot_id = 8");
    app = initializeApp({ projectId: 'demo-warehouse', apiKey: 'test', appId: 'test' });
    const dc = getDataConnect(app, { connector: 'example', service: 'smart-warehouse-service', location: 'asia-southeast1' });
    connectDataConnectEmulator(dc, '127.0.0.1', 9399);
    const run = async (name, variables = {}) => (await executeMutation(mutationRef(dc, name, { productID: 'test-001', ...variables }))).data;
    const read = async (name, variables) => (await executeQuery(queryRef(dc, name, variables), { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })).data;
    const state = async () => ({
      stocks: (await db.query('SELECT product_id, current_status, status_updated_at, expires_on FROM stocks ORDER BY product_id')).rows,
      slots: (await db.query('SELECT slot_id, assigned_product_id, assigned_at FROM slots ORDER BY slot_id')).rows,
      activities: (await db.query('SELECT product_id, activity_type, occurred_at FROM activities ORDER BY activity_id')).rows,
    });
    const stock = s => s.stocks.find(x => x.product_id === 'test-001');
    const slot = (s, id) => s.slots.find(x => x.slot_id === id);
    const events = s => s.activities.map(x => x.activity_type);
    const rejectUnchanged = async (name, variables) => {
      const before = await state();
      await assert.rejects(run(name, variables), undefined, `${name} must reject invalid state/binding`);
      assert.deepEqual(await state(), before, `${name} must roll back all state, timestamps, and activities`);
    };
    const activityFailure = async (name, variables, type) => {
      await db.query(`ALTER TABLE activities ADD CONSTRAINT test_reject_activity CHECK (activity_type <> '${type}') NOT VALID`);
      try {
        await rejectUnchanged(name, variables);
      } finally {
        await db.query('ALTER TABLE activities DROP CONSTRAINT test_reject_activity');
      }
    };
    const recordExpired = async sourceSlotID => {
      const before = await state();
      await run('RecordExpiredScan', { sourceSlotID });
      const after = await state();
      assert.deepEqual(after.stocks, before.stocks);
      assert.deepEqual(after.slots, before.slots);
      assert.deepEqual(events(after), [...events(before), 'REMOVED']);
      assert.ok(after.activities.at(-1).occurred_at);
    };
    const assertTransition = async (name, variables, status, type) => {
      const before = await state();
      const result = await run(name, variables);
      assert.equal(result.stock_updateMany, 1);
      const after = await state();
      assert.equal(stock(after).current_status, status);
      assert.notDeepEqual(stock(after).status_updated_at, stock(before).status_updated_at);
      assert.deepEqual(events(after), [...events(before), type]);
      assert.deepEqual(stock(after).status_updated_at, after.activities.at(-1).occurred_at, 'Use the same trusted request time for status and activity');
      assert.deepEqual(after.stocks.find(x => x.product_id === 'blocker'), before.stocks.find(x => x.product_id === 'blocker'));
      return after;
    };

    await rejectUnchanged('PlaceProduct', { productID: 'missing', targetSlotID: 1 });
    await rejectUnchanged('TakeOffRack', { sourceSlotID: 1 });
    await rejectUnchanged('ReturnProduct', { sourceSlotID: 1 });
    await rejectUnchanged('MoveProduct', { sourceSlotID: 1, targetSlotID: 2 });
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await rejectUnchanged('RecordExpiredScan', { productID: 'missing', sourceSlotID: null });
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: 1 });
    await recordExpired(null);
    await activityFailure('RecordExpiredScan', { sourceSlotID: null }, 'REMOVED');

    for (const targetSlotID of [0, 9, 8]) await rejectUnchanged('PlaceProduct', { targetSlotID });
    await db.query('DELETE FROM slots WHERE slot_id = 5');
    await rejectUnchanged('PlaceProduct', { targetSlotID: 5 });
    await db.query('INSERT INTO slots (slot_id) VALUES (5)');
    await db.query('UPDATE slots SET assigned_at = now() WHERE slot_id = 6');
    await rejectUnchanged('PlaceProduct', { targetSlotID: 6 });
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 6');
    await db.query("UPDATE slots SET assigned_product_id = 'test-001', assigned_at = now() WHERE slot_id = 3");
    await rejectUnchanged('PlaceProduct', { targetSlotID: 1 });
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: null });
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: 3 });
    await db.query('UPDATE slots SET assigned_product_id = NULL, assigned_at = NULL WHERE slot_id = 3');
    await activityFailure('PlaceProduct', { targetSlotID: 1 }, 'ON_RACK');

    let a = await assertTransition('PlaceProduct', { targetSlotID: 1 }, 'OCCUPIED', 'ON_RACK');
    assert.equal(slot(a, 1).assigned_product_id, 'test-001');
    const assigned = slot(a, 1).assigned_at;
    assert.deepEqual(assigned, stock(a).status_updated_at);
    for (const targetSlotID of [1, 2]) await rejectUnchanged('PlaceProduct', { targetSlotID });
    await rejectUnchanged('ReturnProduct', { sourceSlotID: 1 });
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    for (const sourceSlotID of [0, 9, 2, 8]) {
      await rejectUnchanged('TakeOffRack', { sourceSlotID });
      await rejectUnchanged('MoveProduct', { sourceSlotID, targetSlotID: 4 });
      await rejectUnchanged('RecordExpiredScan', { sourceSlotID });
    }
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: null });
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 1');
    await rejectUnchanged('TakeOffRack', { sourceSlotID: 1 });
    await rejectUnchanged('MoveProduct', { sourceSlotID: 1, targetSlotID: 2 });
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: 1 });
    await db.query('UPDATE slots SET assigned_at = $1 WHERE slot_id = 1', [assigned]);
    for (const targetSlotID of [0, 9, 1, 8]) await rejectUnchanged('MoveProduct', { sourceSlotID: 1, targetSlotID });
    await db.query('UPDATE slots SET assigned_at = now() WHERE slot_id = 6');
    await rejectUnchanged('MoveProduct', { sourceSlotID: 1, targetSlotID: 6 });
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 6');
    await recordExpired(1);
    await activityFailure('TakeOffRack', { sourceSlotID: 1 }, 'OFF_RACK');

    a = await assertTransition('TakeOffRack', { sourceSlotID: 1 }, 'PENDING_DISPATCH', 'OFF_RACK');
    assert.deepEqual(slot(a, 1).assigned_at, assigned);
    assert.equal(slot(a, 1).assigned_product_id, 'test-001');
    await rejectUnchanged('TakeOffRack', { sourceSlotID: 1 });
    for (const sourceSlotID of [0, 9, 2, 8]) {
      await rejectUnchanged('ReturnProduct', { sourceSlotID });
      await rejectUnchanged('DispatchProduct', { sourceSlotID });
    }
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 1');
    await rejectUnchanged('ReturnProduct', { sourceSlotID: 1 });
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await db.query('UPDATE slots SET assigned_at = $1 WHERE slot_id = 1', [assigned]);
    await recordExpired(1);
    await activityFailure('ReturnProduct', { sourceSlotID: 1 }, 'ON_RACK');
    await activityFailure('DispatchProduct', { sourceSlotID: 1 }, 'DISPATCHED');

    a = await assertTransition('ReturnProduct', { sourceSlotID: 1 }, 'OCCUPIED', 'ON_RACK');
    assert.deepEqual(slot(a, 1).assigned_at, assigned);
    assert.equal(slot(a, 1).assigned_product_id, 'test-001');
    await rejectUnchanged('ReturnProduct', { sourceSlotID: 1 });
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await activityFailure('MoveProduct', { sourceSlotID: 1, targetSlotID: 2 }, 'ON_RACK');
    a = await assertTransition('MoveProduct', { sourceSlotID: 1, targetSlotID: 2 }, 'OCCUPIED', 'ON_RACK');
    assert.deepEqual(slot(a, 1), { slot_id: 1, assigned_product_id: null, assigned_at: null });
    assert.equal(slot(a, 2).assigned_product_id, 'test-001');
    assert.deepEqual(slot(a, 2).assigned_at, stock(a).status_updated_at);
    await rejectUnchanged('MoveProduct', { sourceSlotID: 1, targetSlotID: 2 });
    await assertTransition('TakeOffRack', { sourceSlotID: 2 }, 'PENDING_DISPATCH', 'OFF_RACK');
    // Moving a reserved product is also allowed and restores OCCUPIED.
    a = await assertTransition('MoveProduct', { sourceSlotID: 2, targetSlotID: 3 }, 'OCCUPIED', 'ON_RACK');
    assert.deepEqual(slot(a, 2), { slot_id: 2, assigned_product_id: null, assigned_at: null });
    assert.equal(slot(a, 3).assigned_product_id, 'test-001');
    await assertTransition('TakeOffRack', { sourceSlotID: 3 }, 'PENDING_DISPATCH', 'OFF_RACK');
    a = await assertTransition('DispatchProduct', { sourceSlotID: 3 }, 'EMPTY', 'DISPATCHED');
    assert.deepEqual(slot(a, 3), { slot_id: 3, assigned_product_id: null, assigned_at: null });
    assert.equal(a.stocks.length, 2, 'Dispatch must not delete stock');
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 3 });
    await recordExpired(null);

    const snapshot = await read('GetLocationSnapshot', { productID: 'test-001' });
    assert.equal(snapshot.stock.currentStatus, 'EMPTY');
    assert.ok(snapshot.stock.statusUpdatedAt);
    assert.equal(snapshot.rackSlots.length, 8);
    assert.deepEqual(snapshot.productBindings, []);
    assert.equal('version' in snapshot.stock, false);
    for (const row of snapshot.rackSlots) assert.equal('version' in row, false);
    assert.equal((await read('GetProductContext', { productID: 'test-001' })).stock.currentStatus, 'EMPTY');
    assert.equal((await read('GetSlotMenu')).slots.length, 8);
    assert.equal((await read('GetSlotBindings')).slots.length, 8);
    assert.equal((await read('GetStockByProductID', { productID: 'test-001' })).stock.productID, 'test-001');
    assert.equal((await read('GetLocationSnapshot', { productID: 'missing' })).stock, null);

    // Small concurrent-submission smoke tests, not a multi-phone guarantee.
    const placement = await Promise.allSettled([run('PlaceProduct', { targetSlotID: 1 }), run('PlaceProduct', { targetSlotID: 1 })]);
    assert.equal(placement.filter(x => x.status === 'fulfilled').length, 1);
    const beforeRace = await state();
    const takeOff = await Promise.allSettled([run('TakeOffRack', { sourceSlotID: 1 }), run('TakeOffRack', { sourceSlotID: 1 })]);
    assert.equal(takeOff.filter(x => x.status === 'fulfilled').length, 1);
    a = await state();
    assert.equal(stock(a).current_status, 'PENDING_DISPATCH');
    assert.deepEqual(slot(a, 1), slot(beforeRace, 1));
    assert.deepEqual(events(a), [...events(beforeRace), 'OFF_RACK']);
    console.log('Disposable emulator: six mutation transitions, reads, binding checks, timestamps, and rollback passed');
  } finally {
    if (app) await deleteApp(app);
    await db.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

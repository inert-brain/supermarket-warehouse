// Only a fresh, disposable emulator. NODE_PATH supplies the existing UI Firebase dependency.
const assert = require('node:assert/strict');
const { Client } = require('../../app/backend/node_modules/pg');
const { initializeApp, deleteApp } = require('../../app/UI/node_modules/firebase/app');
const { getDataConnect, connectDataConnectEmulator, executeMutation, mutationRef, executeQuery, QueryFetchPolicy } = require('../../app/UI/node_modules/firebase/data-connect');
const sdk = require('./example/generated/index.cjs.js');

async function main() {
  if (process.env.LOCATION_TEST_DISPOSABLE !== 'yes' || process.env.FIREBASE_DATACONNECT_POSTGRESQL_STRING) {
    throw new Error('Use LOCATION_TEST_DISPOSABLE=yes with a fresh in-memory emulator and no database override');
  }
  const db = new Client({ host: '127.0.0.1', port: 5432, database: 'smart-warehouse-database', user: 'postgres' });
  await db.connect();
  let app;
  try {
    for (const table of ['stocks', 'slots', 'activities']) {
      assert.equal((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count, '0', 'Refusing a nonempty database');
    }
    assert.deepEqual((await db.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND ((table_name IN ('stocks', 'slots') AND column_name = 'version') OR table_name = 'location_operations')")).rows, []);
    // Sensor reconciliation does not enforce expiry, even on first receipt/return.
    await db.query("INSERT INTO stocks (product_id, current_status, status_updated_at, expires_on) VALUES ('test-001', 'EMPTY', '2000-01-01T00:00:00Z', '2000-01-01'), ('blocker', 'PENDING_DISPATCH', now(), NULL)");
    await db.query('INSERT INTO slots (slot_id) SELECT generate_series(1,8)');
    await db.query("UPDATE slots SET assigned_product_id = 'blocker', assigned_at = now() WHERE slot_id = 8");
    app = initializeApp({ projectId: 'demo-warehouse', apiKey: 'test', appId: 'test' });
    const dc = getDataConnect(app, sdk.connectorConfig);
    connectDataConnectEmulator(dc, '127.0.0.1', 9399);
    const ref = name => {
      const fn = Object.values(sdk).find(value => typeof value === 'function' && value.operationName === name);
      assert.ok(fn, `Generated SDK must export ${name}`);
      return fn;
    };
    const run = async (name, variables = {}) => (await executeMutation(ref(name)(dc, name === 'ReportSlotOccupancy' ? variables : { containerID: 'test-001', ...variables }))).data;
    const read = async (name, variables) => (await executeQuery(ref(name)(dc, variables), { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })).data;
    const report = (slotID, occupied) => run('ReportSlotOccupancy', { slotID, occupied });
    const state = async () => ({
      stocks: (await db.query('SELECT product_id, current_status, status_updated_at, description, expires_on FROM stocks ORDER BY product_id')).rows,
      slots: (await db.query('SELECT slot_id, assigned_product_id, assigned_at, is_occupied, occupancy_updated_at FROM slots ORDER BY slot_id')).rows,
      activities: (await db.query('SELECT product_id, activity_type, occurred_at FROM activities ORDER BY activity_id')).rows,
    });
    const stock = s => s.stocks.find(x => x.product_id === 'test-001');
    const slot = (s, id) => s.slots.find(x => x.slot_id === id);
    const events = s => s.activities.map(x => x.activity_type);
    const rejectUnchanged = async (name, variables) => {
      const before = await state();
      await assert.rejects(run(name, variables), undefined, `${name} must reject invalid state/binding`);
      assert.deepEqual(await state(), before, `${name} must roll back state, timestamps, and activities`);
    };
    const constraintFailure = async (constraint, name, variables) => {
      await db.query(constraint);
      try { await rejectUnchanged(name, variables); }
      finally { await db.query('ALTER TABLE activities DROP CONSTRAINT IF EXISTS test_failure'); await db.query('ALTER TABLE slots DROP CONSTRAINT IF EXISTS test_failure'); await db.query('ALTER TABLE stocks DROP CONSTRAINT IF EXISTS test_failure'); }
    };
    const activityFailure = (name, variables, type) => constraintFailure(`ALTER TABLE activities ADD CONSTRAINT test_failure CHECK (activity_type <> '${type}') NOT VALID`, name, variables);
    const recordExpired = async sourceSlotID => {
      const before = await state();
      const result = await run('RecordExpiredScan', { sourceSlotID });
      assert.equal(typeof result.activity_insert.activityId, 'number');
      const after = await state();
      assert.deepEqual(after.stocks, before.stocks);
      assert.deepEqual(after.slots, before.slots);
      assert.deepEqual(events(after), [...events(before), 'REMOVED']);
    };
    const transition = async (id, occupied, status, event) => {
      const before = await state();
      const result = await report(id, occupied);
      assert.equal(result.observation, 1);
      assert.equal(result.query.slot.slotId, id);
      assert.equal(result.query.slot.containerID, 'test-001');
      assert.equal(result.query.slot.isOccupied, occupied);
      assert.equal(result.query.slot.stock.currentStatus, status);
      const after = await state();
      assert.equal(stock(after).current_status, status);
      assert.notDeepEqual(stock(after).status_updated_at, stock(before).status_updated_at);
      assert.deepEqual(events(after), [...events(before), event]);
      assert.deepEqual(stock(after).status_updated_at, after.activities.at(-1).occurred_at);
      assert.deepEqual(slot(after, id).occupancy_updated_at, stock(after).status_updated_at, 'One trusted request timestamp');
      assert.deepEqual(slot(after, id).assigned_at, slot(before, id).assigned_at);
      assert.equal(slot(after, id).assigned_product_id, 'test-001');
      assert.deepEqual(after.stocks.find(x => x.product_id === 'blocker'), before.stocks.find(x => x.product_id === 'blocker'));
      return after;
    };
    const heartbeat = async (id, occupied) => {
      const before = await state();
      const result = await report(id, occupied);
      assert.equal(result.observation, 1);
      const after = await state();
      assert.deepEqual(after.stocks, before.stocks);
      assert.deepEqual(after.activities, before.activities);
      assert.equal(slot(after, id).is_occupied, occupied);
      assert.ok(slot(after, id).occupancy_updated_at > slot(before, id).occupancy_updated_at);
      assert.deepEqual(slot(after, id).assigned_at, slot(before, id).assigned_at);
    };
    const assignmentOnly = async (name, variables) => {
      const before = await state();
      assert.deepEqual(await run(name, variables), { binding: 1 });
      const after = await state();
      assert.deepEqual(after.stocks, before.stocks, 'Assignment must not count stock or update status time');
      assert.deepEqual(after.activities, before.activities);
      for (const s of after.slots) {
        assert.equal(s.is_occupied, slot(before, s.slot_id).is_occupied);
        assert.deepEqual(s.occupancy_updated_at, slot(before, s.slot_id).occupancy_updated_at);
      }
      return after;
    };
    const age = id => db.query("UPDATE slots SET occupancy_updated_at = '2000-01-01T00:00:00Z' WHERE slot_id = $1", [id]);
    const dispatchOnly = async sourceSlotID => {
      const before = await state();
      assert.deepEqual(await run('DispatchProduct', { sourceSlotID }), { dispatch: 1 });
      const after = await state();
      assert.equal(stock(after).current_status, 'EMPTY');
      assert.deepEqual(stock(after).status_updated_at, after.activities.at(-1).occurred_at);
      assert.deepEqual(events(after), [...events(before), 'DISPATCHED']);
      assert.deepEqual(after.stocks, before.stocks.map(p => p.product_id === 'test-001'
        ? { ...p, current_status: 'EMPTY', status_updated_at: stock(after).status_updated_at } : p));
      assert.deepEqual(after.slots, before.slots.map(s => s.slot_id === sourceSlotID
        ? { ...s, assigned_product_id: null, assigned_at: null } : s));
      await rejectUnchanged('DispatchProduct', { sourceSlotID });
      return after;
    };

    // Registration accepts exact arbitrary strings, never an upsert/update or a receipt.
    const beforeRegistration = await state();
    const registeredIDs = ['000001234567890', "  000-custom/雪-'$1;--  "];
    for (const containerID of registeredIDs) {
      const started = Date.now();
      assert.deepEqual(await run('RegisterScannedProduct', { containerID }), { registration: 1 });
      const finished = Date.now();
      const row = (await db.query('SELECT * FROM stocks WHERE product_id = $1', [containerID])).rows[0];
      assert.equal(row.product_id, containerID);
      assert.equal(row.current_status, 'EMPTY');
      assert.equal(row.description, null);
      assert.equal(row.expires_on, null);
      assert.ok(row.status_updated_at.getTime() >= started && row.status_updated_at.getTime() <= finished);
      assert.deepEqual((await read('GetStockByProductID', { containerID })).stock,
        { containerID, description: null, expiresOn: null });
      const beforeRepeat = await state();
      assert.deepEqual(await run('RegisterScannedProduct', { containerID }), { registration: 0 });
      assert.deepEqual(await state(), beforeRepeat);
    }
    // Every existing status, metadata and old timestamp must survive repeated registration.
    for (const status of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
      const containerID = `registration-known-${status}`;
      await db.query("INSERT INTO stocks (product_id, current_status, status_updated_at, description, expires_on) VALUES ($1, $2, '2001-02-03T04:05:06Z', 'keep exact metadata', '2002-03-04')", [containerID, status]);
      const before = await state();
      for (let i = 0; i < 2; i++) {
        assert.deepEqual(await run('RegisterScannedProduct', { containerID }), { registration: 0 });
        assert.deepEqual(await state(), before);
      }
      await db.query('DELETE FROM stocks WHERE product_id = $1', [containerID]);
    }
    // Existing assigned inventory is also a complete no-op.
    for (const containerID of ['test-001', 'blocker']) {
      const before = await state();
      assert.deepEqual(await run('RegisterScannedProduct', { containerID }), { registration: 0 });
      assert.deepEqual(await state(), before);
    }
    for (const containerID of ['', ' ', '\t\r\n']) {
      await rejectUnchanged('RegisterScannedProduct', { containerID });
    }
    const afterRegistration = await state();
    assert.deepEqual(afterRegistration.slots, beforeRegistration.slots);
    assert.deepEqual(afterRegistration.activities, beforeRegistration.activities);
    await db.query('DELETE FROM stocks WHERE product_id = ANY($1::text[])', [registeredIDs]);
    assert.deepEqual(await state(), beforeRegistration);
    console.log('Registration integration passed: arbitrary exact IDs, request-time EMPTY insertion, null metadata, repeat/all-status preservation, blank rejection, no slot/activity changes and SDK readback');
    if (process.argv.includes('--registration-only')) return;

    const unknown = (await read('GetSlotMenu')).slots;
    for (const s of unknown) { assert.equal(s.isOccupied, null); assert.equal(s.occupancyUpdatedAt, null); }
    for (const targetSlotID of [0, 9, 8]) await rejectUnchanged('AssignProductToSlot', { targetSlotID });
    for (const slotID of [0, 9]) await rejectUnchanged('ReportSlotOccupancy', { slotID, occupied: false });
    await db.query('DELETE FROM slots WHERE slot_id = 5');
    await rejectUnchanged('ReportSlotOccupancy', { slotID: 5, occupied: false });
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 5 });
    await db.query('INSERT INTO slots (slot_id) VALUES (5)');
    await rejectUnchanged('RecordExpiredScan', { containerID: 'missing', sourceSlotID: null });
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: 1 });
    await recordExpired(null);
    await activityFailure('RecordExpiredScan', { sourceSlotID: null }, 'REMOVED');

    // Unknown/unidentified reports persist observations but invent no products/history.
    for (const occupied of [true, true, false, false]) await heartbeat(1, occupied);
    await report(2, false);
    await report(8, false); // Pending reserved slot, no transition.
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 8 });
    await report(1, true);
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 1 });
    await db.query('UPDATE slots SET is_occupied = NULL, occupancy_updated_at = NULL WHERE slot_id = 1');
    await rejectUnchanged('AssignProductToSlot', { containerID: 'missing', targetSlotID: 1 });
    await db.query('UPDATE slots SET assigned_at = now() WHERE slot_id = 1');
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 1 });
    await rejectUnchanged('ReportSlotOccupancy', { slotID: 1, occupied: true });
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 1');

    await constraintFailure('ALTER TABLE slots ADD CONSTRAINT test_failure CHECK (slot_id <> 1 OR assigned_product_id IS NULL) NOT VALID', 'AssignProductToSlot', { targetSlotID: 1 });
    let a = await assignmentOnly('AssignProductToSlot', { targetSlotID: 1 });
    const assigned = slot(a, 1).assigned_at;
    assert.equal(slot(a, 1).assigned_product_id, 'test-001');
    assert.equal(stock(a).current_status, 'EMPTY');
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 1 });
    assert.deepEqual(slot(await state(), 1).assigned_at, assigned);
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 2 }); // Unique product assignment.
    await rejectUnchanged('RecordExpiredScan', { sourceSlotID: null });
    await recordExpired(1); // EMPTY awaiting placement is valid, too.
    await heartbeat(1, false);
    await dispatchOnly(1); // Bound EMPTY is eligible; no warehouse-count decrement.
    await assignmentOnly('AssignProductToSlot', { targetSlotID: 1 });
    await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 1 });
    await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    assert.equal(slot(await state(), 1).assigned_at, null);
    await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 2, targetSlotID: 1 });

    // Deliberately mismatched fixtures: reassignment preserves every stock status,
    // allows false/null on both slots, and never uses observation time as permission.
    for (const status of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
      await db.query('UPDATE stocks SET current_status = $1 WHERE product_id = \'test-001\'', [status]);
      await rejectUnchanged('AssignProductToSlot', { targetSlotID: 3 });
      await db.query('UPDATE slots SET is_occupied = true WHERE slot_id = 1');
      await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
      await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 1 });
      await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
      for (const sourceOccupied of [null, false]) {
        for (const targetOccupied of [null, false]) {
          await db.query('UPDATE slots SET is_occupied = $1, occupancy_updated_at = NULL WHERE slot_id = 1', [sourceOccupied]);
          await db.query("UPDATE slots SET is_occupied = $1, occupancy_updated_at = '2000-01-01T00:00:00Z' WHERE slot_id = 2", [targetOccupied]);
          const beforeSame = await state();
          await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 1 });
          assert.deepEqual(await state(), beforeSame);
          a = await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
          assert.equal(stock(a).current_status, status);
          assert.equal(slot(a, 1).assigned_product_id, null);
          assert.equal(slot(a, 1).assigned_at, null);
          assert.equal(slot(a, 2).assigned_product_id, 'test-001');
          assert.ok(slot(a, 2).assigned_at);
          await db.query("UPDATE slots SET occupancy_updated_at = now() + interval '1 day' WHERE slot_id IN (1, 2)");
          await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 2, targetSlotID: 1 });
          // Null occupancy permits demo dispatch; covered in the dedicated dispatch cases below.
        }
      }
    }
    await db.query("UPDATE stocks SET current_status = 'EMPTY' WHERE product_id = 'test-001'");

    await activityFailure('ReportSlotOccupancy', { slotID: 1, occupied: true }, 'ON_RACK');
    await constraintFailure("ALTER TABLE stocks ADD CONSTRAINT test_failure CHECK (current_status <> 'OCCUPIED') NOT VALID", 'ReportSlotOccupancy', { slotID: 1, occupied: true });
    await constraintFailure('ALTER TABLE slots ADD CONSTRAINT test_failure CHECK (is_occupied IS NOT TRUE) NOT VALID', 'ReportSlotOccupancy', { slotID: 1, occupied: true });
    // Reconcile by product status even when the stored boolean already matches.
    await db.query('UPDATE slots SET is_occupied = true WHERE slot_id = 1');
    a = await transition(1, true, 'OCCUPIED', 'ON_RACK');
    const bindingTime = slot(a, 1).assigned_at;
    await heartbeat(1, true);
    await recordExpired(1);
    await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await rejectUnchanged('AssignProductToSlot', { targetSlotID: 2 });
    await activityFailure('ReportSlotOccupancy', { slotID: 1, occupied: false }, 'OFF_RACK');
    a = await transition(1, false, 'PENDING_DISPATCH', 'OFF_RACK');
    assert.deepEqual(slot(a, 1).assigned_at, bindingTime);
    await heartbeat(1, false);
    await recordExpired(1);
    await activityFailure('ReportSlotOccupancy', { slotID: 1, occupied: true }, 'ON_RACK');
    await transition(1, true, 'OCCUPIED', 'ON_RACK'); // Expired return must still reconcile.
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await transition(1, false, 'PENDING_DISPATCH', 'OFF_RACK');
    for (const sourceSlotID of [0, 9, 2, 8]) {
      await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID, targetSlotID: 3 });
      await rejectUnchanged('DispatchProduct', { sourceSlotID });
    }
    for (const targetSlotID of [0, 9, 8]) await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID });
    await db.query('DELETE FROM slots WHERE slot_id = 3');
    await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 3 });
    await db.query('INSERT INTO slots (slot_id) VALUES (3)');
    await db.query('UPDATE slots SET assigned_at = now() WHERE slot_id = 3');
    await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 3 });
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 3');
    await report(2, true);
    await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    await report(2, false);
    await age(2);
    await age(1);
    await db.query('UPDATE slots SET assigned_at = NULL WHERE slot_id = 1');
    await rejectUnchanged('DispatchProduct', { sourceSlotID: 1 });
    await rejectUnchanged('ReportSlotOccupancy', { slotID: 1, occupied: true });
    await rejectUnchanged('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    await db.query('UPDATE slots SET assigned_at = $1 WHERE slot_id = 1', [bindingTime]);
    await constraintFailure('ALTER TABLE slots ADD CONSTRAINT test_failure CHECK (slot_id <> 2 OR assigned_product_id IS NULL) NOT VALID', 'ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    a = await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 1, targetSlotID: 2 });
    assert.equal(stock(a).current_status, 'PENDING_DISPATCH');
    assert.equal(slot(a, 1).assigned_product_id, null);
    assert.equal(slot(a, 1).assigned_at, null);
    assert.equal(slot(a, 2).assigned_product_id, 'test-001');
    const beforeSame = await state();
    await assignmentOnly('ChangeAssignedSlot', { sourceSlotID: 2, targetSlotID: 2 });
    assert.deepEqual(await state(), beforeSame, 'Same-slot change is a true no-op');
    await activityFailure('DispatchProduct', { sourceSlotID: 2 }, 'DISPATCHED');
    await constraintFailure('ALTER TABLE slots ADD CONSTRAINT test_failure CHECK (slot_id <> 2 OR assigned_product_id IS NOT NULL) NOT VALID', 'DispatchProduct', { sourceSlotID: 2 });
    await constraintFailure("ALTER TABLE stocks ADD CONSTRAINT test_failure CHECK (current_status <> 'EMPTY') NOT VALID", 'DispatchProduct', { sourceSlotID: 2 });
    a = await dispatchOnly(2); // Old false observation remains acceptable.
    assert.equal(a.stocks.length, 2);
    await recordExpired(null);

    // Demo dispatch accepts false or unknown occupancy, for every bound stock status.
    for (const status of ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH']) {
      for (const observedAt of [null, '2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z']) {
        await db.query('UPDATE slots SET is_occupied = NULL, occupancy_updated_at = $1 WHERE slot_id = 3', [observedAt]);
        await assignmentOnly('AssignProductToSlot', { targetSlotID: 3 });
        await db.query("UPDATE stocks SET current_status = $1 WHERE product_id = 'test-001'", [status]);

        await db.query('UPDATE slots SET is_occupied = true WHERE slot_id = 3');
        await rejectUnchanged('DispatchProduct', { sourceSlotID: 3 });
        await db.query('UPDATE slots SET is_occupied = NULL WHERE slot_id = 3');
        await dispatchOnly(3); // Unknown is allowed; duplicate dispatch still rejects after clearing.
      }
    }
    // Unassigned non-EMPTY products cannot use the initial assignment path.
    for (const status of ['OCCUPIED', 'PENDING_DISPATCH']) {
      await db.query("UPDATE stocks SET current_status = $1 WHERE product_id = 'test-001'", [status]);
      await rejectUnchanged('AssignProductToSlot', { targetSlotID: 3 });
    }
    await db.query("UPDATE stocks SET current_status = 'EMPTY' WHERE product_id = 'test-001'");

    const snapshot = await read('GetLocationSnapshot', { containerID: 'test-001' });
    assert.equal(snapshot.stock.currentStatus, 'EMPTY');
    assert.deepEqual(snapshot.productBindings, []);
    assert.equal((await read('GetLocationSnapshot', { containerID: 'missing' })).stock, null);
    for (const s of snapshot.rackSlots) { assert.ok('isOccupied' in s); assert.ok('occupancyUpdatedAt' in s); }
    for (const name of ['GetProductContext', 'GetSlotMenu', 'GetSlotBindings']) {
      const data = await read(name, { containerID: 'blocker' });
      const bound = data.slots.find(s => s.slotId === 8);
      assert.equal(bound.isOccupied, false);
      assert.ok(bound.occupancyUpdatedAt);
    }
    assert.equal((await read('GetStockByProductID', { containerID: 'test-001' })).stock.containerID, 'test-001');
    for (const name of ['PlaceProduct', 'MoveProduct', 'TakeOffRack', 'ReturnProduct']) {
      await assert.rejects(executeMutation(mutationRef(dc, name, { containerID: 'test-001', sourceSlotID: 1, targetSlotID: 2 })));
    }

    // Concurrent submissions: one receipt/removal only, or a safe transaction abort.
    await report(1, false);
    await run('AssignProductToSlot', { targetSlotID: 1 });
    for (const [occupied, type, status] of [[true, 'ON_RACK', 'OCCUPIED'], [false, 'OFF_RACK', 'PENDING_DISPATCH']]) {
      const before = await state();
      const results = await Promise.allSettled([report(1, occupied), report(1, occupied)]);
      assert.ok(results.some(x => x.status === 'fulfilled'));
      a = await state();
      assert.equal(stock(a).current_status, status);
      assert.deepEqual(events(a), [...events(before), type]);
    }
    const beforeRace = await state();
    await Promise.allSettled([report(1, true), run('DispatchProduct', { sourceSlotID: 1 })]);
    a = await state();
    const tail = events(a).slice(events(beforeRace).length);
    if (stock(a).current_status === 'EMPTY') {
      assert.deepEqual(tail, ['DISPATCHED']);
      assert.equal(slot(a, 1).assigned_product_id, null);
    } else {
      assert.equal(stock(a).current_status, 'OCCUPIED');
      assert.deepEqual(tail, ['ON_RACK']);
      assert.equal(slot(a, 1).assigned_product_id, 'test-001');
    }
    console.log('Occupancy integration passed: generated SDK, transition matrix, heartbeats, relaxed null/old occupancy, status-preserving assignment-only moves, dispatch, expired logging, full rollback, queries and concurrent smoke tests');
  } finally {
    if (app) await deleteApp(app);
    await db.end();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

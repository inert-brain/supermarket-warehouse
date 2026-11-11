// Fixtures are written only to a fresh, disposable local emulator; connector calls are queries only.
const assert = require('node:assert/strict');
const { Client } = require('../../app/backend/node_modules/pg');
const { initializeApp, deleteApp } = require('../../app/UI/node_modules/firebase/app');
const { getDataConnect, connectDataConnectEmulator, queryRef, executeQuery, QueryFetchPolicy } = require('../../app/UI/node_modules/firebase/data-connect');

async function main() {
  if (process.env.DASHBOARD_TEST_DISPOSABLE !== 'yes' || process.env.FIREBASE_DATACONNECT_POSTGRESQL_STRING) {
    throw new Error('Use DASHBOARD_TEST_DISPOSABLE=yes with a fresh in-memory emulator and no database override');
  }
  const db = new Client({ host: '127.0.0.1', port: 5432, database: 'smart-warehouse-database', user: 'postgres' });
  await db.connect();
  let app;
  try {
    for (const table of ['stocks', 'slots', 'activities']) {
      assert.equal((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count, '0', 'Refusing a nonempty database');
    }
    app = initializeApp({ projectId: 'demo-warehouse', apiKey: 'test', appId: 'test' });
    const dc = getDataConnect(app, { connector: 'example', service: 'smart-warehouse-service', location: 'asia-southeast1' });
    connectDataConnectEmulator(dc, '127.0.0.1', 9399);
    const read = async (name, variables) => (await executeQuery(queryRef(dc, name, variables), { fetchPolicy: QueryFetchPolicy.SERVER_ONLY })).data;
    const contracts = [
      ['DashboardStocks', 'stocks', 'productID', ['productID', 'currentStatus', 'statusUpdatedAt', 'description', 'expiresOn']],
      ['DashboardSlots', 'slots', 'slotId', ['slotId', 'productID', 'assignedAt']],
      ['DashboardActivities', 'activities', 'activityId', ['activityId', 'productID', 'occurredAt', 'activityType']],
    ];
    for (const [name, field] of contracts) {
      assert.deepEqual(await read(name, { after: null, limit: 100 }), { [field]: [] });
    }
    await db.query("INSERT INTO stocks (product_id, current_status, status_updated_at) SELECT 'dashboard-' || lpad(i::text, 3, '0'), 'EMPTY', '2026-01-01T00:00:00Z' FROM generate_series(1,205) i");
    // Include out-of-menu keys: reporting must return all rows, not just slots 1–8.
    await db.query('INSERT INTO slots (slot_id) SELECT generate_series(-1,203)');
    await db.query("INSERT INTO activities (activity_id, product_id, occurred_at, activity_type) SELECT i, 'dashboard-' || lpad(i::text, 3, '0'), '2026-01-01T00:00:00Z', 'ON_RACK' FROM generate_series(1,205) i");
    await db.query("UPDATE stocks SET description = 'Example unit', expires_on = '2026-12-31', current_status = 'OCCUPIED' WHERE product_id = 'dashboard-002'");
    await db.query("UPDATE slots SET assigned_product_id = 'dashboard-002', assigned_at = '2026-01-01T00:00:00Z' WHERE slot_id = 0");
    for (const [name, field, key, fields] of contracts) {
      const expectedKeys = Array.from({ length: 205 }, (_, i) => field === 'stocks' ? `dashboard-${String(i + 1).padStart(3, '0')}` : field === 'slots' ? i - 1 : i + 1);
      const first = await read(name, { after: null, limit: 1 });
      assert.deepEqual(first[field].map(row => row[key]), expectedKeys.slice(0, 1));
      const rows = [];
      const sizes = [];
      let after = null;
      for (let page = 0; page < 5; page++) {
        const data = await read(name, { after, limit: 100 });
        assert.deepEqual(Object.keys(data), [field]);
        sizes.push(data[field].length);
        for (const row of data[field]) assert.deepEqual(Object.keys(row).sort(), [...fields].sort());
        rows.push(...data[field]);
        if (data[field].length < 100) break;
        after = data[field].at(-1)[key];
      }
      assert.deepEqual(sizes, [100, 100, 5]);
      assert.deepEqual(rows.map(row => row[key]), expectedKeys, 'Ascending keys, no duplicates or gaps');
      assert.deepEqual(await read(name, { after: expectedKeys.at(-1), limit: 100 }), { [field]: [] });
      await assert.rejects(read(name, { after: null }), undefined, 'limit is required, with no default');
      if (field === 'stocks') {
        assert.equal(rows[0].description, null);
        assert.equal(rows[0].expiresOn, null);
        assert.equal(rows[0].currentStatus, 'EMPTY');
        assert.equal(Date.parse(rows[0].statusUpdatedAt), Date.parse('2026-01-01T00:00:00Z'));
        assert.equal(rows[1].description, 'Example unit');
        assert.equal(rows[1].expiresOn, '2026-12-31');
        assert.equal(rows[1].currentStatus, 'OCCUPIED');
      }
      if (field === 'slots') {
        assert.equal(rows[0].productID, null);
        assert.equal(rows[0].assignedAt, null);
        assert.equal(rows[1].productID, 'dashboard-002');
        assert.equal(Date.parse(rows[1].assignedAt), Date.parse('2026-01-01T00:00:00Z'));
      }
      if (field === 'activities') {
        assert.equal(rows[0].activityType, 'ON_RACK');
        assert.equal(Date.parse(rows[0].occurredAt), Date.parse('2026-01-01T00:00:00Z'));
      }
    }
    console.log('Dashboard queries passed: empty tables, null first cursor, limits, 205 rows per table, exact fields, ascending key pagination, terminal empty page, required limit');
  } finally {
    if (app) await deleteApp(app);
    await db.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { decideExpiry, storeDate } from '../src/expiry';
import { loadConfig } from '../src/config';

test('date-only expiry is valid through the store date', () => {
  assert.equal(decideExpiry('2026-03-09', '2026-03-10'), 'EXPIRED');
  assert.equal(decideExpiry('2026-03-10', '2026-03-10'), 'READY_FOR_PUTAWAY');
  assert.equal(decideExpiry('2026-03-11', '2026-03-10'), 'READY_FOR_PUTAWAY');
  for (const value of [null, undefined, '', '2026-02-29', '2026-13-01', '2026-01-01T00:00:00Z']) {
    assert.equal(decideExpiry(value, '2026-03-10'), 'EXPIRY_UNKNOWN');
  }
  assert.equal(decideExpiry('2024-02-29', '2024-02-29'), 'READY_FOR_PUTAWAY');
  assert.throws(() => decideExpiry('2026-01-01', 'invalid'));
});

test('store midnight and DST use the configured timezone, not UTC', () => {
  assert.equal(storeDate(new Date('2026-03-09T15:59:59Z'), 'Asia/Singapore'), '2026-03-09');
  assert.equal(storeDate(new Date('2026-03-09T16:00:00Z'), 'Asia/Singapore'), '2026-03-10');
  assert.equal(decideExpiry('2026-03-09', storeDate(new Date('2026-03-09T16:00:00Z'), 'Asia/Singapore')), 'EXPIRED');
  assert.equal(storeDate(new Date('2026-03-08T04:59:59Z'), 'America/New_York'), '2026-03-07');
  assert.equal(storeDate(new Date('2026-03-08T05:00:00Z'), 'America/New_York'), '2026-03-08');
});

test('configuration requires timezone and validates port', () => {
  assert.throws(() => loadConfig({}), /STORE_TIMEZONE/);
  assert.throws(() => loadConfig({ STORE_TIMEZONE: 'not/a-zone' }), /STORE_TIMEZONE/);
  assert.throws(() => loadConfig({ STORE_TIMEZONE: '+08:00' }), /STORE_TIMEZONE/);
  assert.throws(() => loadConfig({ STORE_TIMEZONE: 'UTC', PORT: '0' }), /PORT/);
  assert.equal(loadConfig({ STORE_TIMEZONE: 'UTC' }).host, '127.0.0.1');
});

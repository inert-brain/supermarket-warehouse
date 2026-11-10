import { Pool, PoolClient } from 'pg';
import { decideExpiry, storeDate } from './expiry';

type Token = { slotId: number; version: number };
type Action = 'PlaceProduct' | 'TakeOffRack' | 'ReturnProduct' | 'MoveProduct' | 'DispatchProduct' | 'RecordExpiredScan';
export type Command = { operationID: string; action: Action; productID: string; productVersion: number; source: Token | null; target: Token | null };
type Outcome = { status: 'committed' | 'conflict'; message: string };
export type Terminal = { operationID: string; command: Command; outcome: Outcome };
type Stock = { product_id: string; current_status: string; version: number; expires_on: string | null };
type Slot = { slot_id: number; assigned_product_id: string | null; assigned_at: Date | null; version: number; status?: string | null };

const actions: Action[] = ['PlaceProduct', 'TakeOffRack', 'ReturnProduct', 'MoveProduct', 'DispatchProduct', 'RecordExpiredScan'];
const keys = (x: Record<string, unknown>, names: string[]) => Object.keys(x).length === names.length && names.every(k => Object.hasOwn(x, k));
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const version = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 2147483647;
const token = (x: unknown): x is Token => object(x) && keys(x, ['slotId', 'version']) && Number.isInteger(x.slotId) && Number(x.slotId) >= 1 && Number(x.slotId) <= 8 && version(x.version);
export function parseCommand(x: unknown): Command | null {
  if (!object(x) || !keys(x, ['operationID', 'action', 'productID', 'productVersion', 'source', 'target']) ||
      typeof x.operationID !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x.operationID) ||
      typeof x.productID !== 'string' || !x.productID.trim() || x.productID.length > 512 ||
      typeof x.action !== 'string' || !actions.includes(x.action as Action) || !version(x.productVersion) ||
      !(x.source === null || token(x.source)) || !(x.target === null || token(x.target))) return null;
  const action = x.action as Action;
  if ((action === 'PlaceProduct' && (x.source !== null || !token(x.target))) ||
      (action === 'MoveProduct' && (!token(x.source) || !token(x.target) || x.source.slotId === x.target.slotId)) ||
      (['TakeOffRack', 'ReturnProduct', 'DispatchProduct'].includes(action) && (!token(x.source) || x.target !== null)) ||
      (action === 'RecordExpiredScan' && x.target !== null)) return null;
  return { operationID: x.operationID, action, productID: x.productID, productVersion: x.productVersion, source: x.source as Token | null, target: x.target as Token | null };
}

async function one(client: PoolClient, sql: string, params: unknown[]): Promise<void> {
  const result = await client.query(sql, params);
  if (result.rowCount !== 1) throw new Error('Unexpected affected row count');
}
const stockQuery = 'SELECT product_id, current_status, version, expires_on::text AS expires_on FROM stocks WHERE product_id = $1';
const slotsQuery = 'SELECT slot_id, assigned_product_id, assigned_at, version FROM slots ORDER BY slot_id';
class BindingsChanged extends Error {}

export class LocationService {
  constructor(private pool: Pool, private timezone: string, private clock: () => Date = () => new Date()) {}

  async operation(id: string): Promise<Terminal | null> {
    const r = await this.pool.query('SELECT payload, outcome, result FROM location_operations WHERE operation_id = $1', [id]);
    if (!r.rowCount) return null;
    return { operationID: id, command: r.rows[0].payload, outcome: r.rows[0].result };
  }

  async snapshot(productID: string): Promise<object | null> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const p = (await c.query<Stock>(stockQuery, [productID])).rows[0];
      if (!p) { await c.query('COMMIT'); return null; }
      const slots = (await c.query<Slot>('SELECT s.slot_id, s.assigned_product_id, s.assigned_at, s.version, st.current_status AS status FROM slots s LEFT JOIN stocks st ON st.product_id = s.assigned_product_id ORDER BY s.slot_id')).rows;
      const decision = decideExpiry(p.expires_on, storeDate(this.clock(), this.timezone));
      const result = { product: { productID: p.product_id, status: p.current_status, version: p.version, expiry: decision === 'READY_FOR_PUTAWAY' ? 'valid' : decision === 'EXPIRED' ? 'expired' : 'unknown' }, slots: slots.map(s => ({ slotId: s.slot_id, productID: s.assigned_product_id, assignedAt: s.assigned_at, version: s.version, status: s.status })) };
      await c.query('COMMIT');
      return result;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  async submit(command: Command): Promise<Terminal | 'mismatch'> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.submitOnce(command); }
      catch (error) {
        if (!(error instanceof BindingsChanged) || attempt >= 2) throw error;
      }
    }
  }

  private async submitOnce(command: Command): Promise<Terminal | 'mismatch'> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      // The provisional row is invisible until commit and is replaced before commit.
      const inserted = await c.query("INSERT INTO location_operations (operation_id, payload, outcome, result, completed_at) VALUES ($1, $2::jsonb, 'conflict', '{}'::jsonb, now()) ON CONFLICT (operation_id) DO NOTHING", [command.operationID, JSON.stringify(command)]);
      if (!inserted.rowCount) {
        const existing = await c.query('SELECT payload, result, payload = $2::jsonb AS matches FROM location_operations WHERE operation_id = $1', [command.operationID, JSON.stringify(command)]);
        await c.query('COMMIT');
        if (!existing.rows[0].matches) return 'mismatch';
        return { operationID: command.operationID, command: existing.rows[0].payload, outcome: existing.rows[0].result };
      }
      // Discover bindings without locks, then lock all relevant stocks in a global order
      // before locking slots. If discovery raced with a new binding, restart instead of
      // acquiring another stock lock out of order.
      const observed = await c.query<{ assigned_product_id: string }>('SELECT DISTINCT assigned_product_id FROM slots WHERE assigned_product_id IS NOT NULL');
      const ids = [...new Set([command.productID, ...observed.rows.map(row => row.assigned_product_id)])];
      const stocks = (await c.query<Stock>('SELECT product_id, current_status, version, expires_on::text AS expires_on FROM stocks WHERE product_id = ANY($1::text[]) ORDER BY product_id COLLATE "C" FOR UPDATE', [ids])).rows;
      const byID = new Map(stocks.map(stock => [stock.product_id, stock]));
      const observedIDs = new Set(ids);
      const p = byID.get(command.productID);
      const slots = (await c.query<Slot>(slotsQuery + ' FOR UPDATE')).rows;
      if (slots.some(slot => slot.assigned_product_id !== null && !observedIDs.has(slot.assigned_product_id))) throw new BindingsChanged();
      const binding = slots.filter(s => s.assigned_product_id === command.productID);
      const boundIDs = slots.flatMap(s => s.assigned_product_id === null ? [] : [s.assigned_product_id]);
      const source = command.source && slots.find(s => s.slot_id === command.source!.slotId);
      const target = command.target && slots.find(s => s.slot_id === command.target!.slotId);
      const now = this.clock();
      let reason = '';
      if (!p) reason = 'PRODUCT_NOT_FOUND';
      else if (p.version !== command.productVersion) reason = 'STALE_PRODUCT';
      else if (slots.length !== 8 || slots.some((s, i) => s.slot_id !== i + 1 || (s.assigned_product_id === null) !== (s.assigned_at === null)) ||
        new Set(boundIDs).size !== boundIDs.length || boundIDs.some(id => !id || !['OCCUPIED', 'PENDING_DISPATCH'].includes(byID.get(id)?.current_status ?? ''))) reason = 'INCONSISTENT_INVENTORY';
      else if (!['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'].includes(p.current_status) || (p.current_status === 'EMPTY' ? binding.length !== 0 : binding.length !== 1)) reason = 'INCONSISTENT_INVENTORY';
      else if ((command.source === null && binding.length !== 0) || (command.source !== null && (!source || source.assigned_product_id !== command.productID || source.version !== command.source.version))) reason = 'STALE_SOURCE';
      else if (command.target && (!target || target.version !== command.target.version || target.assigned_product_id !== null)) reason = 'STALE_TARGET';
      else {
        const expiry = decideExpiry(p.expires_on, storeDate(now, this.timezone));
        if (command.action === 'RecordExpiredScan' ? expiry !== 'EXPIRED' : command.action !== 'TakeOffRack' && expiry !== 'READY_FOR_PUTAWAY') reason = expiry === 'EXPIRY_UNKNOWN' ? 'EXPIRY_UNKNOWN' : 'EXPIRY_MISMATCH';
        const allowed: Record<Action, string[]> = { PlaceProduct: ['EMPTY'], TakeOffRack: ['OCCUPIED'], ReturnProduct: ['PENDING_DISPATCH'], MoveProduct: ['OCCUPIED', 'PENDING_DISPATCH'], DispatchProduct: ['PENDING_DISPATCH'], RecordExpiredScan: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'] };
        if (!reason && !allowed[command.action].includes(p.current_status)) reason = 'INVALID_TRANSITION';
      }
      const outcome: Outcome = reason ? { status: 'conflict', message: reason } : { status: 'committed', message: 'OK' };
      if (!reason && p) {
        const status = command.action === 'TakeOffRack' ? 'PENDING_DISPATCH' : command.action === 'DispatchProduct' ? 'EMPTY' : 'OCCUPIED';
        if (command.action !== 'RecordExpiredScan') {
          await one(c, 'UPDATE stocks SET current_status = $1, status_updated_at = $2, version = version + 1 WHERE product_id = $3 AND version = $4', [status, now, command.productID, command.productVersion]);
          if (source) {
            const clear = command.action === 'MoveProduct' || command.action === 'DispatchProduct';
            await one(c, clear ? 'UPDATE slots SET assigned_product_id = NULL, assigned_at = NULL, version = version + 1 WHERE slot_id = $1 AND version = $2 AND assigned_product_id = $3' : 'UPDATE slots SET version = version + 1 WHERE slot_id = $1 AND version = $2 AND assigned_product_id = $3', [source.slot_id, source.version, command.productID]);
          }
          if (target) await one(c, 'UPDATE slots SET assigned_product_id = $1, assigned_at = $2, version = version + 1 WHERE slot_id = $3 AND version = $4 AND assigned_product_id IS NULL AND assigned_at IS NULL', [command.productID, now, target.slot_id, target.version]);
        }
        const activity = command.action === 'RecordExpiredScan' ? 'REMOVED' : command.action === 'TakeOffRack' ? 'OFF_RACK' : command.action === 'DispatchProduct' ? 'DISPATCHED' : 'ON_RACK';
        await one(c, 'INSERT INTO activities (product_id, activity_type, occurred_at) VALUES ($1, $2, $3)', [command.productID, activity, now]);
      }
      await one(c, 'UPDATE location_operations SET outcome = $2, result = $3::jsonb, completed_at = now() WHERE operation_id = $1', [command.operationID, outcome.status, JSON.stringify(outcome)]);
      await c.query('COMMIT');
      return { operationID: command.operationID, command, outcome };
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
}

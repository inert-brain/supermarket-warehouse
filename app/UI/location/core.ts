export type StockStatus = 'EMPTY' | 'OCCUPIED' | 'PENDING_DISPATCH';
export type Expiry = 'valid' | 'expired' | 'unknown';
export type Slot = { slotId: number; productID: string | null; assignedAt: string | null; version: number; status: StockStatus | null };
export type Product = { productID: string; status: StockStatus; version: number; expiry: Expiry };
export type Snapshot = { product: Product; slots: Slot[] };
export type Action = 'PlaceProduct' | 'TakeOffRack' | 'ReturnProduct' | 'MoveProduct' | 'DispatchProduct' | 'RecordExpiredScan';
export type Command = { operationID: string; action: Action; productID: string; productVersion: number; source: { slotId: number; version: number } | null; target: { slotId: number; version: number } | null };

const version = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;

/** Reject the entire snapshot rather than making inconsistent slots selectable. */
export function validateSnapshot(snapshot: Snapshot, productID: string): Snapshot {
  const bad = () => { throw new Error('Inconsistent inventory data. Do not proceed; contact staff to repair the records.'); };
  if (!snapshot || !snapshot.product || snapshot.product.productID !== productID || !version(snapshot.product.version) ||
      !['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'].includes(snapshot.product.status) ||
      !['valid', 'expired', 'unknown'].includes(snapshot.product.expiry) || !Array.isArray(snapshot.slots) || snapshot.slots.length !== 8) return bad();
  const ids = new Set<number>();
  const products = new Set<string>();
  for (const slot of snapshot.slots) {
    if (!slot || !Number.isInteger(slot.slotId) || slot.slotId < 1 || slot.slotId > 8 || ids.has(slot.slotId) || !version(slot.version)) return bad();
    ids.add(slot.slotId);
    if (slot.productID === null) {
      if (slot.assignedAt !== null || slot.status !== null) return bad();
    } else {
      if (typeof slot.productID !== 'string' || !slot.productID || typeof slot.assignedAt !== 'string' || !slot.assignedAt ||
          !['OCCUPIED', 'PENDING_DISPATCH'].includes(slot.status ?? '') || products.has(slot.productID)) return bad();
      products.add(slot.productID);
      if (slot.productID === productID && slot.status !== snapshot.product.status) return bad();
    }
  }
  const binding = snapshot.slots.filter(slot => slot.productID === productID);
  if ((snapshot.product.status === 'EMPTY' && binding.length !== 0) || (snapshot.product.status !== 'EMPTY' && binding.length !== 1)) return bad();
  return snapshot;
}

export function actionForSlot(snapshot: Snapshot, slotId: number): Action | null {
  const { product, slots } = validateSnapshot(snapshot, snapshot.product.productID);
  const slot = slots.find(item => item.slotId === slotId);
  if (!slot || product.expiry !== 'valid') return null;
  if (slot.productID === product.productID) return product.status === 'PENDING_DISPATCH' ? 'ReturnProduct' : null;
  if (slot.productID !== null) return null;
  return product.status === 'EMPTY' ? 'PlaceProduct' : 'MoveProduct';
}

export function makeCommand(snapshot: Snapshot, action: Action, operationID: string, targetId?: number): Command {
  const { product, slots } = validateSnapshot(snapshot, snapshot.product.productID);
  if (!operationID.trim()) throw new Error('An operation ID is required.');
  const source = slots.find(slot => slot.productID === product.productID);
  const target = slots.find(slot => slot.slotId === targetId);
  const allowed = action === 'TakeOffRack' ? product.status === 'OCCUPIED' :
    action === 'DispatchProduct' ? product.status === 'PENDING_DISPATCH' && product.expiry === 'valid' :
    action === 'RecordExpiredScan' ? product.expiry === 'expired' :
    targetId !== undefined && actionForSlot(snapshot, targetId) === action;
  if (!allowed) throw new Error('This action is not valid for the current inventory state.');
  const token = (slot: Slot) => ({ slotId: slot.slotId, version: slot.version });
  return { operationID, action, productID: product.productID, productVersion: product.version,
    source: source ? token(source) : null,
    target: action === 'PlaceProduct' || action === 'MoveProduct' ? token(target!) : null };
}

export const transitionEffects: Record<Action, { from: StockStatus[]; to: StockStatus | 'unchanged'; activity: 'ON_RACK' | 'OFF_RACK' | 'DISPATCHED' | 'REMOVED'; warehouse: number }> = {
  PlaceProduct: { from: ['EMPTY'], to: 'OCCUPIED', activity: 'ON_RACK', warehouse: 1 },
  TakeOffRack: { from: ['OCCUPIED'], to: 'PENDING_DISPATCH', activity: 'OFF_RACK', warehouse: 0 },
  ReturnProduct: { from: ['PENDING_DISPATCH'], to: 'OCCUPIED', activity: 'ON_RACK', warehouse: 0 },
  MoveProduct: { from: ['OCCUPIED', 'PENDING_DISPATCH'], to: 'OCCUPIED', activity: 'ON_RACK', warehouse: 0 },
  DispatchProduct: { from: ['PENDING_DISPATCH'], to: 'EMPTY', activity: 'DISPATCHED', warehouse: -1 },
  RecordExpiredScan: { from: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'], to: 'unchanged', activity: 'REMOVED', warehouse: 0 },
};

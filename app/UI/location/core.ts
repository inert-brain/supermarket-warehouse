export type StockStatus = 'EMPTY' | 'OCCUPIED' | 'PENDING_DISPATCH';
export type Expiry = 'valid' | 'expired' | 'unknown';
export type Slot = {
  slotId: number;
  productID: string | null;
  assignedAt: string | null;
  status: StockStatus | null;
  isOccupied: boolean | null;
  occupancyUpdatedAt: string | null;
};
export type Product = { productID: string; status: StockStatus; expiry: Expiry };
export type Snapshot = { product: Product; slots: Slot[] };
export type Action = 'AssignProductToSlot' | 'ChangeAssignedSlot' | 'DispatchProduct' | 'RecordExpiredScan';
export type Command = { action: Action; productID: string; sourceSlotID: number | null; targetSlotID: number | null };

export const SNAPSHOT_REFRESH_MS = 5_000;
export type SlotState = 'unknown' | 'available' | 'awaiting' | 'occupied' | 'reserved' | 'unidentified';
export const slotLabels: Record<SlotState, string> = {
  unknown: 'Occupancy unknown / reserved', available: 'Available', awaiting: 'Awaiting placement',
  occupied: 'Occupied', reserved: 'Off-rack / reserved', unidentified: 'Occupied / unidentified',
};

export function slotState(slot: Slot): SlotState {
  if (slot.productID === null) return slot.isOccupied === true ? 'unidentified' : 'available';
  if (slot.isOccupied === true) return 'occupied';
  if (slot.isOccupied === null) return 'unknown';
  return slot.status === 'EMPTY' ? 'awaiting' : 'reserved';
}

/** Reject structural/cross-table inconsistencies; never repair bindings from a read. */
export function validateSnapshot(snapshot: Snapshot, productID: string): Snapshot {
  const bad = () => { throw new Error('Inconsistent inventory data. Refresh for the latest rack update; if it persists, contact staff. No records were repaired.'); };
  if (!snapshot || !snapshot.product || typeof productID !== 'string' || !productID || snapshot.product.productID !== productID ||
      !['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'].includes(snapshot.product.status) ||
      !['valid', 'expired', 'unknown'].includes(snapshot.product.expiry) || !Array.isArray(snapshot.slots) || snapshot.slots.length !== 8) return bad();
  const ids = new Set<number>();
  const products = new Set<string>();
  for (const slot of snapshot.slots) {
    if (!slot || !Number.isInteger(slot.slotId) || slot.slotId < 1 || slot.slotId > 8 || ids.has(slot.slotId) ||
        (slot.isOccupied !== null && typeof slot.isOccupied !== 'boolean') ||
        (slot.occupancyUpdatedAt !== null && (typeof slot.occupancyUpdatedAt !== 'string' || !Number.isFinite(Date.parse(slot.occupancyUpdatedAt))))) return bad();
    ids.add(slot.slotId);
    if (slot.productID === null) {
      if (slot.assignedAt !== null || slot.status !== null) return bad();
    } else {
      if (typeof slot.productID !== 'string' || !slot.productID || typeof slot.assignedAt !== 'string' || !slot.assignedAt ||
          !['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'].includes(slot.status ?? '') || products.has(slot.productID)) return bad();
      products.add(slot.productID);
      if (slot.productID === productID && slot.status !== snapshot.product.status) return bad();
    }
  }
  return snapshot;
}

export function actionForSlot(snapshot: Snapshot, slotId: number): Action | null {
  const { product, slots } = validateSnapshot(snapshot, snapshot.product.productID);
  const target = slots.find(item => item.slotId === slotId);
  if (!target || product.expiry !== 'valid' || slotState(target) !== 'available') return null;
  const source = slots.find(item => item.productID === product.productID);
  if (!source) return 'AssignProductToSlot';
  return source.isOccupied !== true ? 'ChangeAssignedSlot' : null;
}

export function canDispatch(snapshot: Snapshot): boolean {
  const { product, slots } = validateSnapshot(snapshot, snapshot.product.productID);
  const source = slots.find(slot => slot.productID === product.productID);
  return product.expiry === 'valid' && !!source && source.isOccupied !== true;
}

export function makeCommand(snapshot: Snapshot, action: Action, targetId?: number): Command {
  const { product, slots } = validateSnapshot(snapshot, snapshot.product.productID);
  const source = slots.find(slot => slot.productID === product.productID);
  const allowed = action === 'DispatchProduct' ? canDispatch(snapshot) :
    action === 'RecordExpiredScan' ? product.expiry === 'expired' :
    targetId !== undefined && actionForSlot(snapshot, targetId) === action;
  if (!allowed) throw new Error('This action is not valid for the latest inventory and rack observation. Refresh and check the product.');
  return { action, productID: product.productID, sourceSlotID: source?.slotId ?? null,
    targetSlotID: action === 'AssignProductToSlot' || action === 'ChangeAssignedSlot' ? targetId! : null };
}

export const transitionEffects: Record<Action, { from: StockStatus[]; to: StockStatus | 'unchanged'; activity: 'DISPATCHED' | 'REMOVED' | null; warehouse: number | 'derive' }> = {
  AssignProductToSlot: { from: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'], to: 'unchanged', activity: null, warehouse: 0 },
  ChangeAssignedSlot: { from: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'], to: 'unchanged', activity: null, warehouse: 0 },
  DispatchProduct: { from: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'], to: 'EMPTY', activity: 'DISPATCHED', warehouse: 'derive' },
  RecordExpiredScan: { from: ['EMPTY', 'OCCUPIED', 'PENDING_DISPATCH'], to: 'unchanged', activity: 'REMOVED', warehouse: 0 },
};

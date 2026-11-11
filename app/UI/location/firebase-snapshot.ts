import { interpretStock } from '../receiving-core.ts';
import { validateSnapshot, type Snapshot } from './core.ts';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

// Connector aliases are documented in CONTRACT.md; deployment is managed separately.
export function mapLocationSnapshot(data: unknown, productID: string, today: string): Snapshot | null {
  const bad = (): never => { throw new Error('Inconsistent connector snapshot. Retry; if it persists, contact staff to repair inventory.'); };
  if (!object(data) || !('stock' in data) || !Array.isArray(data.rackSlots) || !Array.isArray(data.productBindings)) return bad();
  if (data.stock === null) {
    if (data.productBindings.length !== 0) return bad();
    return null;
  }
  if (!object(data.stock)) return bad();
  const stock = data.stock;
  const decision = interpretStock({ stock }, productID, today).decision;
  const slots = data.rackSlots.map((item: unknown) => {
    if (!object(item)) return bad();
    const joined = item.stock;
    if (item.productID === null ? joined !== null : !object(joined) || joined.productID !== item.productID) return bad();
    return { slotId: item.slotId, productID: item.productID, assignedAt: item.assignedAt,
          isOccupied: item.isOccupied, occupancyUpdatedAt: item.occupancyUpdatedAt,
          status: object(joined) ? joined.currentStatus : null };
  });
  const bindings = data.productBindings;
  if (bindings.some((item: unknown) => !object(item) || item.productID !== productID || !Number.isInteger(item.slotId) || (item.slotId as number) < 1 || (item.slotId as number) > 8)) return bad();
  const matching = slots.filter(slot => slot.productID === productID);
  if (bindings.length !== matching.length || bindings.some((item: unknown) => !object(item) || !matching.some(slot => slot.slotId === item.slotId && slot.assignedAt === item.assignedAt))) return bad();
  return validateSnapshot({ product: { productID, status: stock.currentStatus, expiry: decision === 'EXPIRED' ? 'expired' : decision === 'READY_FOR_PUTAWAY' ? 'valid' : 'unknown' }, slots } as Snapshot, productID);
}


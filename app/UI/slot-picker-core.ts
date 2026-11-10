export type Slot = {
  slotId: number;
  productID: string | null;
  state: 'unknown' | 'available' | 'occupied' | 'reserved' | 'removal_pending';
};

export function slotGrid(data: unknown): Slot[] {
  const rows = Array.isArray(data) ? data : [];
  return Array.from({ length: 8 }, (_, index): Slot => {
    const slotId = index + 1;
    const matches = rows.filter(row => row && typeof row === 'object' && row.slotId === slotId);
    if (matches.length !== 1) return { slotId, productID: null, state: 'unknown' };
    const row = matches[0];
    if ((row.productID !== null && typeof row.productID !== 'string') ||
        !['unknown', 'available', 'occupied', 'reserved', 'removal_pending'].includes(row.state) ||
        (row.state === 'available' && row.productID !== null)) {
      return { slotId, productID: null, state: 'unknown' };
    }
    return { slotId, productID: row.productID, state: row.state };
  });
}

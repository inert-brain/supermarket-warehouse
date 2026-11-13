export type Slot = {
  slotId: number;
  containerID: string | null;
  state: 'unknown' | 'available' | 'occupied' | 'reserved' | 'removal_pending';
};

export function slotGrid(data: unknown): Slot[] {
  const rows = Array.isArray(data) ? data : [];
  return Array.from({ length: 8 }, (_, index): Slot => {
    const slotId = index + 1;
    const matches = rows.filter(row => row && typeof row === 'object' && row.slotId === slotId);
    if (matches.length !== 1) return { slotId, containerID: null, state: 'unknown' };
    const row = matches[0];
    if ((row.containerID !== null && typeof row.containerID !== 'string') ||
        !['unknown', 'available', 'occupied', 'reserved', 'removal_pending'].includes(row.state) ||
        (row.state === 'available' && row.containerID !== null)) {
      return { slotId, containerID: null, state: 'unknown' };
    }
    return { slotId, containerID: row.containerID, state: row.state };
  });
}

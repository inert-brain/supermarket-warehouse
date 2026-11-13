import { executeQuery, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { waitForQuery } from './receiving-core';
import { dataConnect } from './receiving';

export type Slot = {
  slotId: number;
  containerID: string | null;
  state: 'unknown' | 'available' | 'occupied' | 'reserved' | 'removal_pending';
};

export function interpretSlots(data: unknown): Slot[] {
  const invalid = () => new Error('Unexpected slot response. Slot availability is unknown; retry or contact support.');
  if (typeof data !== 'object' || data === null || !('slots' in data) ||
      !Array.isArray(data.slots) || data.slots.length !== 8) throw invalid();

  const seen = new Set<number>();
  const slots: Slot[] = data.slots.map((row: unknown) => {
    if (typeof row !== 'object' || row === null || !('slotId' in row) || !('containerID' in row) ||
        typeof row.slotId !== 'number' || !Number.isInteger(row.slotId) || row.slotId < 1 || row.slotId > 8 ||
        seen.has(row.slotId) || (row.containerID !== null && typeof row.containerID !== 'string')) throw invalid();
    seen.add(row.slotId);
    return { slotId: row.slotId, containerID: row.containerID, state: 'unknown' };
  });
  return slots.sort((a, b) => a.slotId - b.slotId);
}

export async function loadSlots(signal: AbortSignal): Promise<Slot[]> {
  if (signal.aborted) throw new Error('Slot lookup cancelled.');
  const ref = queryRef<unknown, undefined>(dataConnect(), 'GetSlotBindings', undefined);
  let data: unknown;
  try {
    ({ data } = await waitForQuery(executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }), signal));
  } catch {
    if (signal.aborted) throw new Error('Slot lookup cancelled.');
    throw new Error('Could not load slots. Check the connection and Data Connect configuration, then retry.');
  }
  return interpretSlots(data);
}

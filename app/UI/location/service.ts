import { validateSnapshot, type Command, type Snapshot } from './core.ts';

export type Outcome = { status: 'committed'; message: string };
export interface LocationTransport {
  readSnapshot(productID: string): Promise<unknown>;
  executeCommand(command: Command): Promise<void>;
  writesEnabled: boolean;
}
export interface LocationAdapter {
  writesEnabled: boolean;
  read(productID: string, signal: AbortSignal): Promise<Snapshot | null>;
  submit(command: Command): Promise<Outcome>;
}

const actions = ['PlaceProduct', 'TakeOffRack', 'ReturnProduct', 'MoveProduct', 'DispatchProduct', 'RecordExpiredScan'];
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export function commandValue(value: unknown): Command {
  const bad = (): never => { throw new Error('Invalid location command. Refresh inventory before continuing.'); };
  if (!object(value) || Object.keys(value).sort().join(',') !== 'action,productID,sourceSlotID,targetSlotID' ||
      typeof value.action !== 'string' || !actions.includes(value.action) || typeof value.productID !== 'string' || !value.productID) return bad();
  const slot = (x: unknown) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 8);
  if (!slot(value.sourceSlotID) || !slot(value.targetSlotID)) return bad();
  const source = value.sourceSlotID !== null, target = value.targetSlotID !== null;
  if ((value.action === 'PlaceProduct' && (source || !target)) ||
      (value.action === 'MoveProduct' && (!source || !target || value.sourceSlotID === value.targetSlotID)) ||
      (['TakeOffRack', 'ReturnProduct', 'DispatchProduct'].includes(value.action) && (!source || target)) ||
      (value.action === 'RecordExpiredScan' && target)) return bad();
  return value as Command;
}

export function createLocationAdapter(transport: LocationTransport, timeoutMs = 15000): LocationAdapter {
  let submitting = false;
  async function call<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new Error('Location request timed out or was cancelled.');
    let timer: ReturnType<typeof setTimeout>;
    let abort: () => void = () => {};
    const cancelled = new Promise<never>((_, reject) => {
      abort = () => reject(new Error('Location request timed out or was cancelled.'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(abort, timeoutMs);
    });
    try { return await Promise.race([Promise.resolve().then(request), cancelled]); }
    finally { clearTimeout(timer!); signal?.removeEventListener('abort', abort); }
  }
  return {
    writesEnabled: transport.writesEnabled,
    async read(productID, signal) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await call(() => transport.readSnapshot(productID), signal);
        if (result === null) return null;
        try { return validateSnapshot(result as Snapshot, productID); }
        catch (error) { if (attempt || signal.aborted) throw error; }
      }
      throw new Error('Could not load inventory snapshot. Retry.');
    },
    async submit(value) {
      if (!transport.writesEnabled) throw new Error('Location writes are unavailable.');
      if (submitting) throw new Error('A location action is already in progress.');
      const command = commandValue(value);
      submitting = true;
      try {
        // A timeout stops waiting, not the hosted transaction. Never resend automatically.
        await call(() => transport.executeCommand(command));
        return { status: 'committed', message: command.action === 'RecordExpiredScan' ? 'Expired scan recorded.' : 'Inventory updated.' };
      } finally { submitting = false; }
    },
  };
}

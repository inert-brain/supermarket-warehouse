import { makeCommand, validateSnapshot, type Command, type Snapshot } from './core.ts';

export type Outcome = { status: 'committed'; message: string };
export interface LocationTransport {
  readSnapshot(containerID: string): Promise<unknown>;
  executeCommand(command: Command): Promise<void>;
  writesEnabled: boolean;
}
export interface LocationAdapter {
  writesEnabled: boolean;
  read(containerID: string, signal: AbortSignal): Promise<Snapshot | null>;
  submit(command: Command): Promise<Outcome>;
}

const actions = ['AssignProductToSlot', 'ChangeAssignedSlot', 'DispatchProduct', 'RecordExpiredScan'];
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
export function commandValue(value: unknown): Command {
  const bad = (): never => { throw new Error('Invalid location command. Refresh inventory before continuing.'); };
  if (!object(value) || Object.keys(value).sort().join(',') !== 'action,containerID,sourceSlotID,targetSlotID' ||
      typeof value.action !== 'string' || !actions.includes(value.action) || typeof value.containerID !== 'string' || !value.containerID) return bad();
  const slot = (x: unknown) => x === null || (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= 8);
  if (!slot(value.sourceSlotID) || !slot(value.targetSlotID)) return bad();
  const source = value.sourceSlotID !== null, target = value.targetSlotID !== null;
  if ((value.action === 'AssignProductToSlot' && (source || !target)) ||
      (value.action === 'ChangeAssignedSlot' && (!source || !target || value.sourceSlotID === value.targetSlotID)) ||
      (value.action === 'DispatchProduct' && (!source || target)) ||
      (value.action === 'RecordExpiredScan' && target)) return bad();
  return value as Command;
}

/** Recheck eligibility and the exact intended binding immediately before confirmation/submission. */
export async function refreshCommand(adapter: LocationAdapter, expected: Command, signal: AbortSignal): Promise<Snapshot> {
  const snapshot = await adapter.read(expected.containerID, signal);
  if (!snapshot) throw new Error('Product not found. No command was sent.');
  const latest = makeCommand(snapshot, expected.action, expected.targetSlotID ?? undefined);
  if (latest.sourceSlotID !== expected.sourceSlotID || latest.targetSlotID !== expected.targetSlotID) {
    throw new Error('The assignment changed. Review the latest slots and confirm again. No command was sent.');
  }
  return snapshot;
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
    async read(containerID, signal) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await call(() => transport.readSnapshot(containerID), signal);
        if (result === null) return null;
        try { return validateSnapshot(result as Snapshot, containerID); }
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
        return { status: 'committed', message: command.action === 'RecordExpiredScan' ? 'Expired scan recorded. Inventory and slot state unchanged.' :
                  command.action === 'DispatchProduct' ? 'External dispatch recorded.' : `Assignment saved. Put the product in Slot ${command.targetSlotID}. Stock changes only when the rack detects the product.` };
      } finally { submitting = false; }
    },
  };
}

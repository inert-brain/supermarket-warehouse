import type { Command, Snapshot } from './core';

export type Outcome = { status: 'committed' | 'conflict'; message: string };

/** See CONTRACT.md. The implementation must persist a command before sending it. */
export interface LocationAdapter {
  read(productID: string, signal: AbortSignal): Promise<Snapshot | null>;
  pending(): Promise<Command | null>;
  prepare(command: Omit<Command, 'operationID'>): Promise<Command>;
  submit(command: Command): Promise<Outcome>;
  resolve(command: Command): Promise<Outcome | null>;
  clear(operationID: string): Promise<void>;
}

// Intentionally not wired to unverified connector mutations or volatile storage.
export const locationAdapter: LocationAdapter | null = null;

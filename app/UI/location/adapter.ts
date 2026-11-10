import { createLocationAdapter } from './service';
import { firebaseLocationTransport } from './firebase-transport';

export type { LocationAdapter, Outcome } from './service';
export const locationAdapter = createLocationAdapter(firebaseLocationTransport);

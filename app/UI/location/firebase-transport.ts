import { executeMutation, executeQuery, mutationRef, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { dataConnect } from '../receiving';
import { localDate } from '../receiving-core';
import { createCommandTransport, type CommandVariables } from './firebase-command';
import { mapLocationSnapshot } from './firebase-snapshot';
import type { LocationTransport } from './service';

const commands = createCommandTransport({
  async mutate(name, variables) {
    const ref = mutationRef<unknown, CommandVariables>(dataConnect(), name, variables);
    return executeMutation(ref);
  },

});

export const firebaseLocationTransport: LocationTransport = {
  writesEnabled: true,
  async readSnapshot(containerID) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const ref = queryRef<unknown, { containerID: string }>(dataConnect(), 'GetLocationSnapshot', { containerID });
      const { data } = await executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
      try { return mapLocationSnapshot(data, containerID, localDate(new Date())); }
      catch (error) { if (attempt) throw error; }
    }
    throw new Error('Could not load inventory snapshot. Retry.');
  },
  ...commands,
};

import { getApp, getApps, initializeApp } from 'firebase/app';
import { executeMutation, executeQuery, getDataConnect, mutationRef, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { lookupOrRegister, waitForQuery, type ReceivingResult } from './receiving-core';

export type { ReceivingResult } from './receiving-core';

function firebaseApp() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) {
    throw new Error('Configure the Firebase web app settings and reload the app.');
  }
  return getApps().some(item => item.name === '[DEFAULT]')
    ? getApp()
    : initializeApp({ apiKey, projectId, appId });
}

export function dataConnect() {
  return getDataConnect(firebaseApp(), {
    connector: 'example', service: 'smart-supermarket-service', location: 'asia-southeast1',
  });
}

// Save the exact scanned text directly; no product catalog or read-back lookup.
export async function saveContainerProduct(containerID: string, productCode: string, signal: AbortSignal): Promise<void> {
  if (!productCode.trim()) throw new Error('The product barcode is empty. Scan again.');
  if (signal.aborted) throw new Error('Product scan cancelled.');
  const ref = mutationRef<unknown, { containerID: string; productCode: string }>(dataConnect(), 'SaveContainerProduct', { containerID, productCode });
  try {
    const result = await waitForQuery(executeMutation(ref), signal);
    if (typeof result.data !== 'object' || result.data === null || !('saved' in result.data) || result.data.saved !== 1)
      throw new Error('Unconfirmed');
  } catch {
    throw new Error('Save could not be confirmed and may have completed. Refresh the container before trying again.');
  }
}


export async function validateReceiving(barcode: string, signal: AbortSignal): Promise<ReceivingResult> {
  return lookupOrRegister(barcode, signal, {
    async lookup(containerID) {
      const ref = queryRef<unknown, { containerID: string }>(dataConnect(), 'GetStockByProductID', { containerID });
      const { data } = await executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
      return data;
    },
    async register(containerID) {
      const ref = mutationRef<unknown, { containerID: string }>(dataConnect(), 'RegisterScannedProduct', { containerID });
      const { data } = await executeMutation(ref);
      return data;
    },
  });
}

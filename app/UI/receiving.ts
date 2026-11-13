import { getApp, getApps, initializeApp } from 'firebase/app';
import { executeMutation, executeQuery, getDataConnect, mutationRef, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { interpretStock, localDate, lookupOrRegister, waitForQuery, type ReceivingResult } from './receiving-core';

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

// The Firestore catalog and Data Connect are separate services. The catalog
// check is client-side; the mutation updates only the selected stock row.
export async function saveContainerProduct(containerID: string, productCode: string, signal: AbortSignal): Promise<void> {
  if (!productCode.trim() || productCode.includes('/')) throw new Error('Invalid product barcode. Scan again.');
  const check = () => { if (signal.aborted) throw new Error('Product scan cancelled.'); };
  check();
  let exists: boolean;
  try {
    const product = await waitForQuery(getDocFromServer(doc(getFirestore(firebaseApp()), 'shopping-cart', productCode)), signal);
    exists = product.exists();
  } catch {
    check();
    throw new Error('Could not check the product catalog. Check the connection and retry.');
  }
  check();
  if (!exists) throw new Error('Product barcode not found in the catalog. Scan again.');
  const ref = mutationRef<unknown, { containerID: string; productCode: string }>(dataConnect(), 'SaveContainerProduct', { containerID, productCode });
  try {
    const result = await waitForQuery(executeMutation(ref), signal);
    if (typeof result.data !== 'object' || result.data === null || !('saved' in result.data) || result.data.saved !== 1)
      throw new Error('Unconfirmed');
  } catch {
    check();
    // The write may have committed; read the selected stock before another attempt.
    const ref = queryRef<unknown, { containerID: string }>(dataConnect(), 'GetStockByProductID', { containerID });
    try {
      const { data } = await waitForQuery(executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }), signal);
      if (typeof data === 'object' && data !== null && 'stock' in data &&
          typeof data.stock === 'object' && data.stock !== null && 'description' in data.stock &&
          data.stock.description === productCode) return;
    } catch { check(); }
    throw new Error('Save could not be confirmed. Refresh the container before trying again.');
  }
}

export async function readContainer(containerID: string, signal: AbortSignal): Promise<ReceivingResult> {
  const ref = queryRef<unknown, { containerID: string }>(dataConnect(), 'GetStockByProductID', { containerID });
  const { data } = await waitForQuery(executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }), signal);
  if (signal.aborted) throw new Error('Lookup cancelled.');
  return { ...interpretStock(data, containerID, localDate(new Date())), registered: false };
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

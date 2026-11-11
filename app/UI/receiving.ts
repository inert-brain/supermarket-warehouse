import { getApp, getApps, initializeApp } from 'firebase/app';
import { executeMutation, executeQuery, getDataConnect, mutationRef, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { lookupOrRegister, type ReceivingResult } from './receiving-core';

export type { ReceivingResult } from './receiving-core';

export function dataConnect() {
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) {
    throw new Error('Configure the Firebase web app settings and reload the app.');
  }
  const app = getApps().some(item => item.name === '[DEFAULT]')
    ? getApp()
    : initializeApp({ apiKey, projectId, appId });
  return getDataConnect(app, {
    connector: 'example', service: 'smart-supermarket-service', location: 'asia-southeast1',
  });
}


export async function validateReceiving(barcode: string, signal: AbortSignal): Promise<ReceivingResult> {
  return lookupOrRegister(barcode, signal, {
    async lookup(productID) {
      const ref = queryRef<unknown, { productID: string }>(dataConnect(), 'GetStockByProductID', { productID });
      const { data } = await executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY });
      return data;
    },
    async register(productID) {
      const ref = mutationRef<unknown, { productID: string }>(dataConnect(), 'RegisterScannedProduct', { productID });
      const { data } = await executeMutation(ref);
      return data;
    },
  });
}

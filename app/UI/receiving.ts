import { getApp, getApps, initializeApp } from 'firebase/app';
import { executeQuery, getDataConnect, queryRef, QueryFetchPolicy } from 'firebase/data-connect';
import { interpretStock, localDate, waitForQuery, type ValidationResult } from './receiving-core';

export type { ValidationResult } from './receiving-core';

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
    connector: 'example', service: 'smart-warehouse-service', location: 'asia-southeast1',
  });
}


export async function validateReceiving(barcode: string, signal: AbortSignal): Promise<ValidationResult> {
  if (!barcode.trim()) throw new Error('The barcode is empty. Scan it again.');

  if (signal.aborted) throw new Error('Lookup cancelled.');
  const dc = dataConnect();
  const ref = queryRef<unknown, { productID: string }>(dc, 'GetStockByProductID', { productID: barcode });
  let data: unknown;
  try {
    ({ data } = await waitForQuery(executeQuery(ref, { fetchPolicy: QueryFetchPolicy.SERVER_ONLY }), signal));
  } catch {
    throw new Error('Could not look up the product. Check the connection and Data Connect configuration, then retry.');
  }
  return interpretStock(data, barcode, localDate(new Date()));
}

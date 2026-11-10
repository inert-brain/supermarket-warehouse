import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Activity_Key {
  activityId: number;
  __typename?: 'Activity_Key';
}

export interface GetStockByProductIdData {
  stock?: {
    productID: string;
    description?: string | null;
    expiresOn?: DateString | null;
  } & Stock_Key;
}

export interface GetStockByProductIdVariables {
  productID: string;
}

export interface Slot_Key {
  slotId: number;
  __typename?: 'Slot_Key';
}

export interface Stock_Key {
  productID: string;
  __typename?: 'Stock_Key';
}

interface GetStockByProductIdRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStockByProductIdVariables): QueryRef<GetStockByProductIdData, GetStockByProductIdVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetStockByProductIdVariables): QueryRef<GetStockByProductIdData, GetStockByProductIdVariables>;
  operationName: string;
}
export const getStockByProductIdRef: GetStockByProductIdRef;

export function getStockByProductId(vars: GetStockByProductIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetStockByProductIdData, GetStockByProductIdVariables>;
export function getStockByProductId(dc: DataConnect, vars: GetStockByProductIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetStockByProductIdData, GetStockByProductIdVariables>;


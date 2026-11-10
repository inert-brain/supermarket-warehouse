import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;


export enum StockStatus {
  EMPTY = "EMPTY",
  OCCUPIED = "OCCUPIED",
  PENDING_DISPATCH = "PENDING_DISPATCH",
}



export interface Activity_Key {
  activityId: number;
  __typename?: 'Activity_Key';
}

export interface DispatchProductData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}

export interface DispatchProductVariables {
  productID: string;
  sourceSlotID: number;
}

export interface GetLocationSnapshotData {
  stock?: {
    productID: string;
    description?: string | null;
    expiresOn?: DateString | null;
    currentStatus: StockStatus;
    statusUpdatedAt: TimestampString;
  } & Stock_Key;
  rackSlots: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
    stock?: {
      productID: string;
      currentStatus: StockStatus;
    } & Stock_Key;
  } & Slot_Key)[];
  productBindings: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
  } & Slot_Key)[];
}

export interface GetLocationSnapshotVariables {
  productID: string;
}

export interface GetProductContextData {
  stock?: {
    productID: string;
    description?: string | null;
    expiresOn?: DateString | null;
    currentStatus: StockStatus;
    statusUpdatedAt: TimestampString;
  } & Stock_Key;
  slots: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
  } & Slot_Key)[];
}

export interface GetProductContextVariables {
  productID: string;
}

export interface GetSlotBindingsData {
  slots: ({
    slotId: number;
    productID?: string | null;
  } & Slot_Key)[];
}

export interface GetSlotMenuData {
  slots: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
    stock?: {
      productID: string;
      currentStatus: StockStatus;
    } & Stock_Key;
  } & Slot_Key)[];
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

export interface MoveProductData {
  stock_updateMany: number;
  source: number;
  target: number;
  activity_insert: Activity_Key;
}

export interface MoveProductVariables {
  productID: string;
  sourceSlotID: number;
  targetSlotID: number;
}

export interface PlaceProductData {
  stock_updateMany: number;
  slot_updateMany: number;
  activity_insert: Activity_Key;
}

export interface PlaceProductVariables {
  productID: string;
  targetSlotID: number;
}

export interface RecordExpiredScanData {
  query?: {
    stock?: {
      currentStatus: StockStatus;
    };
    bindings: ({
      slotId: number;
      assignedAt?: TimestampString | null;
    } & Slot_Key)[];
  };
  activity_insert: Activity_Key;
}

export interface RecordExpiredScanVariables {
  productID: string;
  sourceSlotID?: number | null;
}

export interface ReturnProductData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}

export interface ReturnProductVariables {
  productID: string;
  sourceSlotID: number;
}

export interface Slot_Key {
  slotId: number;
  __typename?: 'Slot_Key';
}

export interface Stock_Key {
  productID: string;
  __typename?: 'Stock_Key';
}

export interface TakeOffRackData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}

export interface TakeOffRackVariables {
  productID: string;
  sourceSlotID: number;
}

interface PlaceProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: PlaceProductVariables): MutationRef<PlaceProductData, PlaceProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: PlaceProductVariables): MutationRef<PlaceProductData, PlaceProductVariables>;
  operationName: string;
}
export const placeProductRef: PlaceProductRef;

export function placeProduct(vars: PlaceProductVariables): MutationPromise<PlaceProductData, PlaceProductVariables>;
export function placeProduct(dc: DataConnect, vars: PlaceProductVariables): MutationPromise<PlaceProductData, PlaceProductVariables>;

interface TakeOffRackRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: TakeOffRackVariables): MutationRef<TakeOffRackData, TakeOffRackVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: TakeOffRackVariables): MutationRef<TakeOffRackData, TakeOffRackVariables>;
  operationName: string;
}
export const takeOffRackRef: TakeOffRackRef;

export function takeOffRack(vars: TakeOffRackVariables): MutationPromise<TakeOffRackData, TakeOffRackVariables>;
export function takeOffRack(dc: DataConnect, vars: TakeOffRackVariables): MutationPromise<TakeOffRackData, TakeOffRackVariables>;

interface ReturnProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReturnProductVariables): MutationRef<ReturnProductData, ReturnProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReturnProductVariables): MutationRef<ReturnProductData, ReturnProductVariables>;
  operationName: string;
}
export const returnProductRef: ReturnProductRef;

export function returnProduct(vars: ReturnProductVariables): MutationPromise<ReturnProductData, ReturnProductVariables>;
export function returnProduct(dc: DataConnect, vars: ReturnProductVariables): MutationPromise<ReturnProductData, ReturnProductVariables>;

interface MoveProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: MoveProductVariables): MutationRef<MoveProductData, MoveProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: MoveProductVariables): MutationRef<MoveProductData, MoveProductVariables>;
  operationName: string;
}
export const moveProductRef: MoveProductRef;

export function moveProduct(vars: MoveProductVariables): MutationPromise<MoveProductData, MoveProductVariables>;
export function moveProduct(dc: DataConnect, vars: MoveProductVariables): MutationPromise<MoveProductData, MoveProductVariables>;

interface DispatchProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DispatchProductVariables): MutationRef<DispatchProductData, DispatchProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DispatchProductVariables): MutationRef<DispatchProductData, DispatchProductVariables>;
  operationName: string;
}
export const dispatchProductRef: DispatchProductRef;

export function dispatchProduct(vars: DispatchProductVariables): MutationPromise<DispatchProductData, DispatchProductVariables>;
export function dispatchProduct(dc: DataConnect, vars: DispatchProductVariables): MutationPromise<DispatchProductData, DispatchProductVariables>;

interface RecordExpiredScanRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordExpiredScanVariables): MutationRef<RecordExpiredScanData, RecordExpiredScanVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RecordExpiredScanVariables): MutationRef<RecordExpiredScanData, RecordExpiredScanVariables>;
  operationName: string;
}
export const recordExpiredScanRef: RecordExpiredScanRef;

export function recordExpiredScan(vars: RecordExpiredScanVariables): MutationPromise<RecordExpiredScanData, RecordExpiredScanVariables>;
export function recordExpiredScan(dc: DataConnect, vars: RecordExpiredScanVariables): MutationPromise<RecordExpiredScanData, RecordExpiredScanVariables>;

interface GetSlotBindingsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlotBindingsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSlotBindingsData, undefined>;
  operationName: string;
}
export const getSlotBindingsRef: GetSlotBindingsRef;

export function getSlotBindings(options?: ExecuteQueryOptions): QueryPromise<GetSlotBindingsData, undefined>;
export function getSlotBindings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSlotBindingsData, undefined>;

interface GetProductContextRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProductContextVariables): QueryRef<GetProductContextData, GetProductContextVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetProductContextVariables): QueryRef<GetProductContextData, GetProductContextVariables>;
  operationName: string;
}
export const getProductContextRef: GetProductContextRef;

export function getProductContext(vars: GetProductContextVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductContextData, GetProductContextVariables>;
export function getProductContext(dc: DataConnect, vars: GetProductContextVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductContextData, GetProductContextVariables>;

interface GetSlotMenuRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlotMenuData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetSlotMenuData, undefined>;
  operationName: string;
}
export const getSlotMenuRef: GetSlotMenuRef;

export function getSlotMenu(options?: ExecuteQueryOptions): QueryPromise<GetSlotMenuData, undefined>;
export function getSlotMenu(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSlotMenuData, undefined>;

interface GetLocationSnapshotRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLocationSnapshotVariables): QueryRef<GetLocationSnapshotData, GetLocationSnapshotVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetLocationSnapshotVariables): QueryRef<GetLocationSnapshotData, GetLocationSnapshotVariables>;
  operationName: string;
}
export const getLocationSnapshotRef: GetLocationSnapshotRef;

export function getLocationSnapshot(vars: GetLocationSnapshotVariables, options?: ExecuteQueryOptions): QueryPromise<GetLocationSnapshotData, GetLocationSnapshotVariables>;
export function getLocationSnapshot(dc: DataConnect, vars: GetLocationSnapshotVariables, options?: ExecuteQueryOptions): QueryPromise<GetLocationSnapshotData, GetLocationSnapshotVariables>;

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


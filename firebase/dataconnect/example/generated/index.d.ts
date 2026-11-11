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

export interface AssignProductToSlotData {
  binding?: number | null;
}

export interface AssignProductToSlotVariables {
  productID: string;
  targetSlotID: number;
}

export interface ChangeAssignedSlotData {
  binding?: number | null;
}

export interface ChangeAssignedSlotVariables {
  productID: string;
  sourceSlotID: number;
  targetSlotID: number;
}

export interface DashboardActivitiesData {
  activities?: unknown[] | null;
}

export interface DashboardActivitiesVariables {
  after?: number | null;
  limit: number;
}

export interface DashboardSlotsData {
  slots?: unknown[] | null;
}

export interface DashboardSlotsVariables {
  after?: number | null;
  limit: number;
}

export interface DashboardStocksData {
  stocks?: unknown[] | null;
}

export interface DashboardStocksVariables {
  after?: string | null;
  limit: number;
}

export interface DispatchProductData {
  dispatch?: number | null;
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
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
    stock?: {
      productID: string;
      currentStatus: StockStatus;
    } & Stock_Key;
  } & Slot_Key)[];
  productBindings: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
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
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
  } & Slot_Key)[];
}

export interface GetProductContextVariables {
  productID: string;
}

export interface GetSlotBindingsData {
  slots: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
  } & Slot_Key)[];
}

export interface GetSlotMenuData {
  slots: ({
    slotId: number;
    productID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
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

export interface RegisterScannedProductData {
  registration?: number | null;
}

export interface RegisterScannedProductVariables {
  productID: string;
}

export interface ReportSlotOccupancyData {
  observation?: number | null;
  query?: {
    slot?: {
      slotId: number;
      productID?: string | null;
      assignedAt?: TimestampString | null;
      isOccupied?: boolean | null;
      occupancyUpdatedAt?: TimestampString | null;
      stock?: {
        productID: string;
        currentStatus: StockStatus;
        statusUpdatedAt: TimestampString;
      } & Stock_Key;
    } & Slot_Key;
  };
}

export interface ReportSlotOccupancyVariables {
  slotID: number;
  occupied: boolean;
}

export interface Slot_Key {
  slotId: number;
  __typename?: 'Slot_Key';
}

export interface Stock_Key {
  productID: string;
  __typename?: 'Stock_Key';
}

interface RegisterScannedProductRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RegisterScannedProductVariables): MutationRef<RegisterScannedProductData, RegisterScannedProductVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RegisterScannedProductVariables): MutationRef<RegisterScannedProductData, RegisterScannedProductVariables>;
  operationName: string;
}
export const registerScannedProductRef: RegisterScannedProductRef;

export function registerScannedProduct(vars: RegisterScannedProductVariables): MutationPromise<RegisterScannedProductData, RegisterScannedProductVariables>;
export function registerScannedProduct(dc: DataConnect, vars: RegisterScannedProductVariables): MutationPromise<RegisterScannedProductData, RegisterScannedProductVariables>;

interface ReportSlotOccupancyRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReportSlotOccupancyVariables): MutationRef<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ReportSlotOccupancyVariables): MutationRef<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;
  operationName: string;
}
export const reportSlotOccupancyRef: ReportSlotOccupancyRef;

export function reportSlotOccupancy(vars: ReportSlotOccupancyVariables): MutationPromise<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;
export function reportSlotOccupancy(dc: DataConnect, vars: ReportSlotOccupancyVariables): MutationPromise<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;

interface AssignProductToSlotRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AssignProductToSlotVariables): MutationRef<AssignProductToSlotData, AssignProductToSlotVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AssignProductToSlotVariables): MutationRef<AssignProductToSlotData, AssignProductToSlotVariables>;
  operationName: string;
}
export const assignProductToSlotRef: AssignProductToSlotRef;

export function assignProductToSlot(vars: AssignProductToSlotVariables): MutationPromise<AssignProductToSlotData, AssignProductToSlotVariables>;
export function assignProductToSlot(dc: DataConnect, vars: AssignProductToSlotVariables): MutationPromise<AssignProductToSlotData, AssignProductToSlotVariables>;

interface ChangeAssignedSlotRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: ChangeAssignedSlotVariables): MutationRef<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: ChangeAssignedSlotVariables): MutationRef<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;
  operationName: string;
}
export const changeAssignedSlotRef: ChangeAssignedSlotRef;

export function changeAssignedSlot(vars: ChangeAssignedSlotVariables): MutationPromise<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;
export function changeAssignedSlot(dc: DataConnect, vars: ChangeAssignedSlotVariables): MutationPromise<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;

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

interface DashboardStocksRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardStocksVariables): QueryRef<DashboardStocksData, DashboardStocksVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DashboardStocksVariables): QueryRef<DashboardStocksData, DashboardStocksVariables>;
  operationName: string;
}
export const dashboardStocksRef: DashboardStocksRef;

export function dashboardStocks(vars: DashboardStocksVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardStocksData, DashboardStocksVariables>;
export function dashboardStocks(dc: DataConnect, vars: DashboardStocksVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardStocksData, DashboardStocksVariables>;

interface DashboardSlotsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardSlotsVariables): QueryRef<DashboardSlotsData, DashboardSlotsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DashboardSlotsVariables): QueryRef<DashboardSlotsData, DashboardSlotsVariables>;
  operationName: string;
}
export const dashboardSlotsRef: DashboardSlotsRef;

export function dashboardSlots(vars: DashboardSlotsVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardSlotsData, DashboardSlotsVariables>;
export function dashboardSlots(dc: DataConnect, vars: DashboardSlotsVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardSlotsData, DashboardSlotsVariables>;

interface DashboardActivitiesRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardActivitiesVariables): QueryRef<DashboardActivitiesData, DashboardActivitiesVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: DashboardActivitiesVariables): QueryRef<DashboardActivitiesData, DashboardActivitiesVariables>;
  operationName: string;
}
export const dashboardActivitiesRef: DashboardActivitiesRef;

export function dashboardActivities(vars: DashboardActivitiesVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardActivitiesData, DashboardActivitiesVariables>;
export function dashboardActivities(dc: DataConnect, vars: DashboardActivitiesVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardActivitiesData, DashboardActivitiesVariables>;

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


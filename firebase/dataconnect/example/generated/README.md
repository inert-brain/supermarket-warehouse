# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetSlotBindings*](#getslotbindings)
  - [*GetProductContext*](#getproductcontext)
  - [*GetSlotMenu*](#getslotmenu)
  - [*GetLocationSnapshot*](#getlocationsnapshot)
  - [*DashboardStocks*](#dashboardstocks)
  - [*DashboardSlots*](#dashboardslots)
  - [*DashboardActivities*](#dashboardactivities)
  - [*GetStockByProductID*](#getstockbyproductid)
- [**Mutations**](#mutations)
  - [*RegisterScannedProduct*](#registerscannedproduct)
  - [*ReportSlotOccupancy*](#reportslotoccupancy)
  - [*AssignProductToSlot*](#assignproducttoslot)
  - [*ChangeAssignedSlot*](#changeassignedslot)
  - [*DispatchProduct*](#dispatchproduct)
  - [*RecordExpiredScan*](#recordexpiredscan)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/example` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/example';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/example';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetSlotBindings
You can execute the `GetSlotBindings` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getSlotBindings(options?: ExecuteQueryOptions): QueryPromise<GetSlotBindingsData, undefined>;

interface GetSlotBindingsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlotBindingsData, undefined>;
}
export const getSlotBindingsRef: GetSlotBindingsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSlotBindings(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSlotBindingsData, undefined>;

interface GetSlotBindingsRef {
  ...
  (dc: DataConnect): QueryRef<GetSlotBindingsData, undefined>;
}
export const getSlotBindingsRef: GetSlotBindingsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSlotBindingsRef:
```typescript
const name = getSlotBindingsRef.operationName;
console.log(name);
```

### Variables
The `GetSlotBindings` query has no variables.
### Return Type
Recall that executing the `GetSlotBindings` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSlotBindingsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSlotBindingsData {
  slots: ({
    slotId: number;
    containerID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
  } & Slot_Key)[];
}
```
### Using `GetSlotBindings`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSlotBindings } from '@dataconnect/example';


// Call the `getSlotBindings()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSlotBindings();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSlotBindings(dataConnect);

console.log(data.slots);

// Or, you can use the `Promise` API.
getSlotBindings().then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

### Using `GetSlotBindings`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSlotBindingsRef } from '@dataconnect/example';


// Call the `getSlotBindingsRef()` function to get a reference to the query.
const ref = getSlotBindingsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSlotBindingsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.slots);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

## GetProductContext
You can execute the `GetProductContext` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getProductContext(vars: GetProductContextVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductContextData, GetProductContextVariables>;

interface GetProductContextRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetProductContextVariables): QueryRef<GetProductContextData, GetProductContextVariables>;
}
export const getProductContextRef: GetProductContextRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getProductContext(dc: DataConnect, vars: GetProductContextVariables, options?: ExecuteQueryOptions): QueryPromise<GetProductContextData, GetProductContextVariables>;

interface GetProductContextRef {
  ...
  (dc: DataConnect, vars: GetProductContextVariables): QueryRef<GetProductContextData, GetProductContextVariables>;
}
export const getProductContextRef: GetProductContextRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getProductContextRef:
```typescript
const name = getProductContextRef.operationName;
console.log(name);
```

### Variables
The `GetProductContext` query requires an argument of type `GetProductContextVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetProductContextVariables {
  containerID: string;
}
```
### Return Type
Recall that executing the `GetProductContext` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetProductContextData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetProductContextData {
  stock?: {
    containerID: string;
    description?: string | null;
    expiresOn?: DateString | null;
    currentStatus: StockStatus;
    statusUpdatedAt: TimestampString;
  } & Stock_Key;
  slots: ({
    slotId: number;
    containerID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
  } & Slot_Key)[];
}
```
### Using `GetProductContext`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getProductContext, GetProductContextVariables } from '@dataconnect/example';

// The `GetProductContext` query requires an argument of type `GetProductContextVariables`:
const getProductContextVars: GetProductContextVariables = {
  containerID: ...,
};

// Call the `getProductContext()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getProductContext(getProductContextVars);
// Variables can be defined inline as well.
const { data } = await getProductContext({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getProductContext(dataConnect, getProductContextVars);

console.log(data.stock);
console.log(data.slots);

// Or, you can use the `Promise` API.
getProductContext(getProductContextVars).then((response) => {
  const data = response.data;
  console.log(data.stock);
  console.log(data.slots);
});
```

### Using `GetProductContext`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getProductContextRef, GetProductContextVariables } from '@dataconnect/example';

// The `GetProductContext` query requires an argument of type `GetProductContextVariables`:
const getProductContextVars: GetProductContextVariables = {
  containerID: ...,
};

// Call the `getProductContextRef()` function to get a reference to the query.
const ref = getProductContextRef(getProductContextVars);
// Variables can be defined inline as well.
const ref = getProductContextRef({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getProductContextRef(dataConnect, getProductContextVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.stock);
console.log(data.slots);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.stock);
  console.log(data.slots);
});
```

## GetSlotMenu
You can execute the `GetSlotMenu` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getSlotMenu(options?: ExecuteQueryOptions): QueryPromise<GetSlotMenuData, undefined>;

interface GetSlotMenuRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetSlotMenuData, undefined>;
}
export const getSlotMenuRef: GetSlotMenuRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getSlotMenu(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetSlotMenuData, undefined>;

interface GetSlotMenuRef {
  ...
  (dc: DataConnect): QueryRef<GetSlotMenuData, undefined>;
}
export const getSlotMenuRef: GetSlotMenuRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getSlotMenuRef:
```typescript
const name = getSlotMenuRef.operationName;
console.log(name);
```

### Variables
The `GetSlotMenu` query has no variables.
### Return Type
Recall that executing the `GetSlotMenu` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetSlotMenuData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetSlotMenuData {
  slots: ({
    slotId: number;
    containerID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
    stock?: {
      containerID: string;
      currentStatus: StockStatus;
    } & Stock_Key;
  } & Slot_Key)[];
}
```
### Using `GetSlotMenu`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getSlotMenu } from '@dataconnect/example';


// Call the `getSlotMenu()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getSlotMenu();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getSlotMenu(dataConnect);

console.log(data.slots);

// Or, you can use the `Promise` API.
getSlotMenu().then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

### Using `GetSlotMenu`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getSlotMenuRef } from '@dataconnect/example';


// Call the `getSlotMenuRef()` function to get a reference to the query.
const ref = getSlotMenuRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getSlotMenuRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.slots);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

## GetLocationSnapshot
You can execute the `GetLocationSnapshot` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getLocationSnapshot(vars: GetLocationSnapshotVariables, options?: ExecuteQueryOptions): QueryPromise<GetLocationSnapshotData, GetLocationSnapshotVariables>;

interface GetLocationSnapshotRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetLocationSnapshotVariables): QueryRef<GetLocationSnapshotData, GetLocationSnapshotVariables>;
}
export const getLocationSnapshotRef: GetLocationSnapshotRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getLocationSnapshot(dc: DataConnect, vars: GetLocationSnapshotVariables, options?: ExecuteQueryOptions): QueryPromise<GetLocationSnapshotData, GetLocationSnapshotVariables>;

interface GetLocationSnapshotRef {
  ...
  (dc: DataConnect, vars: GetLocationSnapshotVariables): QueryRef<GetLocationSnapshotData, GetLocationSnapshotVariables>;
}
export const getLocationSnapshotRef: GetLocationSnapshotRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getLocationSnapshotRef:
```typescript
const name = getLocationSnapshotRef.operationName;
console.log(name);
```

### Variables
The `GetLocationSnapshot` query requires an argument of type `GetLocationSnapshotVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetLocationSnapshotVariables {
  containerID: string;
}
```
### Return Type
Recall that executing the `GetLocationSnapshot` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetLocationSnapshotData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetLocationSnapshotData {
  stock?: {
    containerID: string;
    description?: string | null;
    expiresOn?: DateString | null;
    currentStatus: StockStatus;
    statusUpdatedAt: TimestampString;
  } & Stock_Key;
  rackSlots: ({
    slotId: number;
    containerID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
    stock?: {
      containerID: string;
      currentStatus: StockStatus;
    } & Stock_Key;
  } & Slot_Key)[];
  productBindings: ({
    slotId: number;
    containerID?: string | null;
    assignedAt?: TimestampString | null;
    isOccupied?: boolean | null;
    occupancyUpdatedAt?: TimestampString | null;
  } & Slot_Key)[];
}
```
### Using `GetLocationSnapshot`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getLocationSnapshot, GetLocationSnapshotVariables } from '@dataconnect/example';

// The `GetLocationSnapshot` query requires an argument of type `GetLocationSnapshotVariables`:
const getLocationSnapshotVars: GetLocationSnapshotVariables = {
  containerID: ...,
};

// Call the `getLocationSnapshot()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getLocationSnapshot(getLocationSnapshotVars);
// Variables can be defined inline as well.
const { data } = await getLocationSnapshot({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getLocationSnapshot(dataConnect, getLocationSnapshotVars);

console.log(data.stock);
console.log(data.rackSlots);
console.log(data.productBindings);

// Or, you can use the `Promise` API.
getLocationSnapshot(getLocationSnapshotVars).then((response) => {
  const data = response.data;
  console.log(data.stock);
  console.log(data.rackSlots);
  console.log(data.productBindings);
});
```

### Using `GetLocationSnapshot`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getLocationSnapshotRef, GetLocationSnapshotVariables } from '@dataconnect/example';

// The `GetLocationSnapshot` query requires an argument of type `GetLocationSnapshotVariables`:
const getLocationSnapshotVars: GetLocationSnapshotVariables = {
  containerID: ...,
};

// Call the `getLocationSnapshotRef()` function to get a reference to the query.
const ref = getLocationSnapshotRef(getLocationSnapshotVars);
// Variables can be defined inline as well.
const ref = getLocationSnapshotRef({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getLocationSnapshotRef(dataConnect, getLocationSnapshotVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.stock);
console.log(data.rackSlots);
console.log(data.productBindings);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.stock);
  console.log(data.rackSlots);
  console.log(data.productBindings);
});
```

## DashboardStocks
You can execute the `DashboardStocks` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
dashboardStocks(vars: DashboardStocksVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardStocksData, DashboardStocksVariables>;

interface DashboardStocksRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardStocksVariables): QueryRef<DashboardStocksData, DashboardStocksVariables>;
}
export const dashboardStocksRef: DashboardStocksRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
dashboardStocks(dc: DataConnect, vars: DashboardStocksVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardStocksData, DashboardStocksVariables>;

interface DashboardStocksRef {
  ...
  (dc: DataConnect, vars: DashboardStocksVariables): QueryRef<DashboardStocksData, DashboardStocksVariables>;
}
export const dashboardStocksRef: DashboardStocksRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the dashboardStocksRef:
```typescript
const name = dashboardStocksRef.operationName;
console.log(name);
```

### Variables
The `DashboardStocks` query requires an argument of type `DashboardStocksVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DashboardStocksVariables {
  after?: string | null;
  limit: number;
}
```
### Return Type
Recall that executing the `DashboardStocks` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DashboardStocksData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DashboardStocksData {
  stocks?: unknown[] | null;
}
```
### Using `DashboardStocks`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, dashboardStocks, DashboardStocksVariables } from '@dataconnect/example';

// The `DashboardStocks` query requires an argument of type `DashboardStocksVariables`:
const dashboardStocksVars: DashboardStocksVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardStocks()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await dashboardStocks(dashboardStocksVars);
// Variables can be defined inline as well.
const { data } = await dashboardStocks({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await dashboardStocks(dataConnect, dashboardStocksVars);

console.log(data.stocks);

// Or, you can use the `Promise` API.
dashboardStocks(dashboardStocksVars).then((response) => {
  const data = response.data;
  console.log(data.stocks);
});
```

### Using `DashboardStocks`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, dashboardStocksRef, DashboardStocksVariables } from '@dataconnect/example';

// The `DashboardStocks` query requires an argument of type `DashboardStocksVariables`:
const dashboardStocksVars: DashboardStocksVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardStocksRef()` function to get a reference to the query.
const ref = dashboardStocksRef(dashboardStocksVars);
// Variables can be defined inline as well.
const ref = dashboardStocksRef({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = dashboardStocksRef(dataConnect, dashboardStocksVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.stocks);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.stocks);
});
```

## DashboardSlots
You can execute the `DashboardSlots` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
dashboardSlots(vars: DashboardSlotsVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardSlotsData, DashboardSlotsVariables>;

interface DashboardSlotsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardSlotsVariables): QueryRef<DashboardSlotsData, DashboardSlotsVariables>;
}
export const dashboardSlotsRef: DashboardSlotsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
dashboardSlots(dc: DataConnect, vars: DashboardSlotsVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardSlotsData, DashboardSlotsVariables>;

interface DashboardSlotsRef {
  ...
  (dc: DataConnect, vars: DashboardSlotsVariables): QueryRef<DashboardSlotsData, DashboardSlotsVariables>;
}
export const dashboardSlotsRef: DashboardSlotsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the dashboardSlotsRef:
```typescript
const name = dashboardSlotsRef.operationName;
console.log(name);
```

### Variables
The `DashboardSlots` query requires an argument of type `DashboardSlotsVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DashboardSlotsVariables {
  after?: number | null;
  limit: number;
}
```
### Return Type
Recall that executing the `DashboardSlots` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DashboardSlotsData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DashboardSlotsData {
  slots?: unknown[] | null;
}
```
### Using `DashboardSlots`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, dashboardSlots, DashboardSlotsVariables } from '@dataconnect/example';

// The `DashboardSlots` query requires an argument of type `DashboardSlotsVariables`:
const dashboardSlotsVars: DashboardSlotsVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardSlots()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await dashboardSlots(dashboardSlotsVars);
// Variables can be defined inline as well.
const { data } = await dashboardSlots({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await dashboardSlots(dataConnect, dashboardSlotsVars);

console.log(data.slots);

// Or, you can use the `Promise` API.
dashboardSlots(dashboardSlotsVars).then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

### Using `DashboardSlots`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, dashboardSlotsRef, DashboardSlotsVariables } from '@dataconnect/example';

// The `DashboardSlots` query requires an argument of type `DashboardSlotsVariables`:
const dashboardSlotsVars: DashboardSlotsVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardSlotsRef()` function to get a reference to the query.
const ref = dashboardSlotsRef(dashboardSlotsVars);
// Variables can be defined inline as well.
const ref = dashboardSlotsRef({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = dashboardSlotsRef(dataConnect, dashboardSlotsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.slots);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.slots);
});
```

## DashboardActivities
You can execute the `DashboardActivities` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
dashboardActivities(vars: DashboardActivitiesVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardActivitiesData, DashboardActivitiesVariables>;

interface DashboardActivitiesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DashboardActivitiesVariables): QueryRef<DashboardActivitiesData, DashboardActivitiesVariables>;
}
export const dashboardActivitiesRef: DashboardActivitiesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
dashboardActivities(dc: DataConnect, vars: DashboardActivitiesVariables, options?: ExecuteQueryOptions): QueryPromise<DashboardActivitiesData, DashboardActivitiesVariables>;

interface DashboardActivitiesRef {
  ...
  (dc: DataConnect, vars: DashboardActivitiesVariables): QueryRef<DashboardActivitiesData, DashboardActivitiesVariables>;
}
export const dashboardActivitiesRef: DashboardActivitiesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the dashboardActivitiesRef:
```typescript
const name = dashboardActivitiesRef.operationName;
console.log(name);
```

### Variables
The `DashboardActivities` query requires an argument of type `DashboardActivitiesVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DashboardActivitiesVariables {
  after?: number | null;
  limit: number;
}
```
### Return Type
Recall that executing the `DashboardActivities` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DashboardActivitiesData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DashboardActivitiesData {
  activities?: unknown[] | null;
}
```
### Using `DashboardActivities`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, dashboardActivities, DashboardActivitiesVariables } from '@dataconnect/example';

// The `DashboardActivities` query requires an argument of type `DashboardActivitiesVariables`:
const dashboardActivitiesVars: DashboardActivitiesVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardActivities()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await dashboardActivities(dashboardActivitiesVars);
// Variables can be defined inline as well.
const { data } = await dashboardActivities({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await dashboardActivities(dataConnect, dashboardActivitiesVars);

console.log(data.activities);

// Or, you can use the `Promise` API.
dashboardActivities(dashboardActivitiesVars).then((response) => {
  const data = response.data;
  console.log(data.activities);
});
```

### Using `DashboardActivities`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, dashboardActivitiesRef, DashboardActivitiesVariables } from '@dataconnect/example';

// The `DashboardActivities` query requires an argument of type `DashboardActivitiesVariables`:
const dashboardActivitiesVars: DashboardActivitiesVariables = {
  after: ..., // optional
  limit: ...,
};

// Call the `dashboardActivitiesRef()` function to get a reference to the query.
const ref = dashboardActivitiesRef(dashboardActivitiesVars);
// Variables can be defined inline as well.
const ref = dashboardActivitiesRef({ after: ..., limit: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = dashboardActivitiesRef(dataConnect, dashboardActivitiesVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.activities);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.activities);
});
```

## GetStockByProductID
You can execute the `GetStockByProductID` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
getStockByProductId(vars: GetStockByProductIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetStockByProductIdData, GetStockByProductIdVariables>;

interface GetStockByProductIdRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetStockByProductIdVariables): QueryRef<GetStockByProductIdData, GetStockByProductIdVariables>;
}
export const getStockByProductIdRef: GetStockByProductIdRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getStockByProductId(dc: DataConnect, vars: GetStockByProductIdVariables, options?: ExecuteQueryOptions): QueryPromise<GetStockByProductIdData, GetStockByProductIdVariables>;

interface GetStockByProductIdRef {
  ...
  (dc: DataConnect, vars: GetStockByProductIdVariables): QueryRef<GetStockByProductIdData, GetStockByProductIdVariables>;
}
export const getStockByProductIdRef: GetStockByProductIdRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getStockByProductIdRef:
```typescript
const name = getStockByProductIdRef.operationName;
console.log(name);
```

### Variables
The `GetStockByProductID` query requires an argument of type `GetStockByProductIdVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetStockByProductIdVariables {
  containerID: string;
}
```
### Return Type
Recall that executing the `GetStockByProductID` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetStockByProductIdData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetStockByProductIdData {
  stock?: {
    containerID: string;
    description?: string | null;
    expiresOn?: DateString | null;
  } & Stock_Key;
}
```
### Using `GetStockByProductID`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getStockByProductId, GetStockByProductIdVariables } from '@dataconnect/example';

// The `GetStockByProductID` query requires an argument of type `GetStockByProductIdVariables`:
const getStockByProductIdVars: GetStockByProductIdVariables = {
  containerID: ...,
};

// Call the `getStockByProductId()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getStockByProductId(getStockByProductIdVars);
// Variables can be defined inline as well.
const { data } = await getStockByProductId({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getStockByProductId(dataConnect, getStockByProductIdVars);

console.log(data.stock);

// Or, you can use the `Promise` API.
getStockByProductId(getStockByProductIdVars).then((response) => {
  const data = response.data;
  console.log(data.stock);
});
```

### Using `GetStockByProductID`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getStockByProductIdRef, GetStockByProductIdVariables } from '@dataconnect/example';

// The `GetStockByProductID` query requires an argument of type `GetStockByProductIdVariables`:
const getStockByProductIdVars: GetStockByProductIdVariables = {
  containerID: ...,
};

// Call the `getStockByProductIdRef()` function to get a reference to the query.
const ref = getStockByProductIdRef(getStockByProductIdVars);
// Variables can be defined inline as well.
const ref = getStockByProductIdRef({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getStockByProductIdRef(dataConnect, getStockByProductIdVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.stock);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.stock);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## RegisterScannedProduct
You can execute the `RegisterScannedProduct` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
registerScannedProduct(vars: RegisterScannedProductVariables): MutationPromise<RegisterScannedProductData, RegisterScannedProductVariables>;

interface RegisterScannedProductRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RegisterScannedProductVariables): MutationRef<RegisterScannedProductData, RegisterScannedProductVariables>;
}
export const registerScannedProductRef: RegisterScannedProductRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
registerScannedProduct(dc: DataConnect, vars: RegisterScannedProductVariables): MutationPromise<RegisterScannedProductData, RegisterScannedProductVariables>;

interface RegisterScannedProductRef {
  ...
  (dc: DataConnect, vars: RegisterScannedProductVariables): MutationRef<RegisterScannedProductData, RegisterScannedProductVariables>;
}
export const registerScannedProductRef: RegisterScannedProductRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the registerScannedProductRef:
```typescript
const name = registerScannedProductRef.operationName;
console.log(name);
```

### Variables
The `RegisterScannedProduct` mutation requires an argument of type `RegisterScannedProductVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RegisterScannedProductVariables {
  containerID: string;
}
```
### Return Type
Recall that executing the `RegisterScannedProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RegisterScannedProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RegisterScannedProductData {
  registration?: number | null;
}
```
### Using `RegisterScannedProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, registerScannedProduct, RegisterScannedProductVariables } from '@dataconnect/example';

// The `RegisterScannedProduct` mutation requires an argument of type `RegisterScannedProductVariables`:
const registerScannedProductVars: RegisterScannedProductVariables = {
  containerID: ...,
};

// Call the `registerScannedProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await registerScannedProduct(registerScannedProductVars);
// Variables can be defined inline as well.
const { data } = await registerScannedProduct({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await registerScannedProduct(dataConnect, registerScannedProductVars);

console.log(data.registration);

// Or, you can use the `Promise` API.
registerScannedProduct(registerScannedProductVars).then((response) => {
  const data = response.data;
  console.log(data.registration);
});
```

### Using `RegisterScannedProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, registerScannedProductRef, RegisterScannedProductVariables } from '@dataconnect/example';

// The `RegisterScannedProduct` mutation requires an argument of type `RegisterScannedProductVariables`:
const registerScannedProductVars: RegisterScannedProductVariables = {
  containerID: ...,
};

// Call the `registerScannedProductRef()` function to get a reference to the mutation.
const ref = registerScannedProductRef(registerScannedProductVars);
// Variables can be defined inline as well.
const ref = registerScannedProductRef({ containerID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = registerScannedProductRef(dataConnect, registerScannedProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.registration);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.registration);
});
```

## ReportSlotOccupancy
You can execute the `ReportSlotOccupancy` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
reportSlotOccupancy(vars: ReportSlotOccupancyVariables): MutationPromise<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;

interface ReportSlotOccupancyRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReportSlotOccupancyVariables): MutationRef<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;
}
export const reportSlotOccupancyRef: ReportSlotOccupancyRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
reportSlotOccupancy(dc: DataConnect, vars: ReportSlotOccupancyVariables): MutationPromise<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;

interface ReportSlotOccupancyRef {
  ...
  (dc: DataConnect, vars: ReportSlotOccupancyVariables): MutationRef<ReportSlotOccupancyData, ReportSlotOccupancyVariables>;
}
export const reportSlotOccupancyRef: ReportSlotOccupancyRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the reportSlotOccupancyRef:
```typescript
const name = reportSlotOccupancyRef.operationName;
console.log(name);
```

### Variables
The `ReportSlotOccupancy` mutation requires an argument of type `ReportSlotOccupancyVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ReportSlotOccupancyVariables {
  slotID: number;
  occupied: boolean;
}
```
### Return Type
Recall that executing the `ReportSlotOccupancy` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReportSlotOccupancyData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ReportSlotOccupancyData {
  observation?: number | null;
  query?: {
    slot?: {
      slotId: number;
      containerID?: string | null;
      assignedAt?: TimestampString | null;
      isOccupied?: boolean | null;
      occupancyUpdatedAt?: TimestampString | null;
      stock?: {
        containerID: string;
        currentStatus: StockStatus;
        statusUpdatedAt: TimestampString;
      } & Stock_Key;
    } & Slot_Key;
  };
}
```
### Using `ReportSlotOccupancy`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, reportSlotOccupancy, ReportSlotOccupancyVariables } from '@dataconnect/example';

// The `ReportSlotOccupancy` mutation requires an argument of type `ReportSlotOccupancyVariables`:
const reportSlotOccupancyVars: ReportSlotOccupancyVariables = {
  slotID: ...,
  occupied: ...,
};

// Call the `reportSlotOccupancy()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await reportSlotOccupancy(reportSlotOccupancyVars);
// Variables can be defined inline as well.
const { data } = await reportSlotOccupancy({ slotID: ..., occupied: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await reportSlotOccupancy(dataConnect, reportSlotOccupancyVars);

console.log(data.observation);
console.log(data.query);

// Or, you can use the `Promise` API.
reportSlotOccupancy(reportSlotOccupancyVars).then((response) => {
  const data = response.data;
  console.log(data.observation);
  console.log(data.query);
});
```

### Using `ReportSlotOccupancy`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, reportSlotOccupancyRef, ReportSlotOccupancyVariables } from '@dataconnect/example';

// The `ReportSlotOccupancy` mutation requires an argument of type `ReportSlotOccupancyVariables`:
const reportSlotOccupancyVars: ReportSlotOccupancyVariables = {
  slotID: ...,
  occupied: ...,
};

// Call the `reportSlotOccupancyRef()` function to get a reference to the mutation.
const ref = reportSlotOccupancyRef(reportSlotOccupancyVars);
// Variables can be defined inline as well.
const ref = reportSlotOccupancyRef({ slotID: ..., occupied: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = reportSlotOccupancyRef(dataConnect, reportSlotOccupancyVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.observation);
console.log(data.query);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.observation);
  console.log(data.query);
});
```

## AssignProductToSlot
You can execute the `AssignProductToSlot` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
assignProductToSlot(vars: AssignProductToSlotVariables): MutationPromise<AssignProductToSlotData, AssignProductToSlotVariables>;

interface AssignProductToSlotRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AssignProductToSlotVariables): MutationRef<AssignProductToSlotData, AssignProductToSlotVariables>;
}
export const assignProductToSlotRef: AssignProductToSlotRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
assignProductToSlot(dc: DataConnect, vars: AssignProductToSlotVariables): MutationPromise<AssignProductToSlotData, AssignProductToSlotVariables>;

interface AssignProductToSlotRef {
  ...
  (dc: DataConnect, vars: AssignProductToSlotVariables): MutationRef<AssignProductToSlotData, AssignProductToSlotVariables>;
}
export const assignProductToSlotRef: AssignProductToSlotRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the assignProductToSlotRef:
```typescript
const name = assignProductToSlotRef.operationName;
console.log(name);
```

### Variables
The `AssignProductToSlot` mutation requires an argument of type `AssignProductToSlotVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AssignProductToSlotVariables {
  containerID: string;
  targetSlotID: number;
}
```
### Return Type
Recall that executing the `AssignProductToSlot` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AssignProductToSlotData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AssignProductToSlotData {
  binding?: number | null;
}
```
### Using `AssignProductToSlot`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, assignProductToSlot, AssignProductToSlotVariables } from '@dataconnect/example';

// The `AssignProductToSlot` mutation requires an argument of type `AssignProductToSlotVariables`:
const assignProductToSlotVars: AssignProductToSlotVariables = {
  containerID: ...,
  targetSlotID: ...,
};

// Call the `assignProductToSlot()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await assignProductToSlot(assignProductToSlotVars);
// Variables can be defined inline as well.
const { data } = await assignProductToSlot({ containerID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await assignProductToSlot(dataConnect, assignProductToSlotVars);

console.log(data.binding);

// Or, you can use the `Promise` API.
assignProductToSlot(assignProductToSlotVars).then((response) => {
  const data = response.data;
  console.log(data.binding);
});
```

### Using `AssignProductToSlot`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, assignProductToSlotRef, AssignProductToSlotVariables } from '@dataconnect/example';

// The `AssignProductToSlot` mutation requires an argument of type `AssignProductToSlotVariables`:
const assignProductToSlotVars: AssignProductToSlotVariables = {
  containerID: ...,
  targetSlotID: ...,
};

// Call the `assignProductToSlotRef()` function to get a reference to the mutation.
const ref = assignProductToSlotRef(assignProductToSlotVars);
// Variables can be defined inline as well.
const ref = assignProductToSlotRef({ containerID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = assignProductToSlotRef(dataConnect, assignProductToSlotVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.binding);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.binding);
});
```

## ChangeAssignedSlot
You can execute the `ChangeAssignedSlot` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
changeAssignedSlot(vars: ChangeAssignedSlotVariables): MutationPromise<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;

interface ChangeAssignedSlotRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ChangeAssignedSlotVariables): MutationRef<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;
}
export const changeAssignedSlotRef: ChangeAssignedSlotRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
changeAssignedSlot(dc: DataConnect, vars: ChangeAssignedSlotVariables): MutationPromise<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;

interface ChangeAssignedSlotRef {
  ...
  (dc: DataConnect, vars: ChangeAssignedSlotVariables): MutationRef<ChangeAssignedSlotData, ChangeAssignedSlotVariables>;
}
export const changeAssignedSlotRef: ChangeAssignedSlotRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the changeAssignedSlotRef:
```typescript
const name = changeAssignedSlotRef.operationName;
console.log(name);
```

### Variables
The `ChangeAssignedSlot` mutation requires an argument of type `ChangeAssignedSlotVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ChangeAssignedSlotVariables {
  containerID: string;
  sourceSlotID: number;
  targetSlotID: number;
}
```
### Return Type
Recall that executing the `ChangeAssignedSlot` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ChangeAssignedSlotData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ChangeAssignedSlotData {
  binding?: number | null;
}
```
### Using `ChangeAssignedSlot`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, changeAssignedSlot, ChangeAssignedSlotVariables } from '@dataconnect/example';

// The `ChangeAssignedSlot` mutation requires an argument of type `ChangeAssignedSlotVariables`:
const changeAssignedSlotVars: ChangeAssignedSlotVariables = {
  containerID: ...,
  sourceSlotID: ...,
  targetSlotID: ...,
};

// Call the `changeAssignedSlot()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await changeAssignedSlot(changeAssignedSlotVars);
// Variables can be defined inline as well.
const { data } = await changeAssignedSlot({ containerID: ..., sourceSlotID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await changeAssignedSlot(dataConnect, changeAssignedSlotVars);

console.log(data.binding);

// Or, you can use the `Promise` API.
changeAssignedSlot(changeAssignedSlotVars).then((response) => {
  const data = response.data;
  console.log(data.binding);
});
```

### Using `ChangeAssignedSlot`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, changeAssignedSlotRef, ChangeAssignedSlotVariables } from '@dataconnect/example';

// The `ChangeAssignedSlot` mutation requires an argument of type `ChangeAssignedSlotVariables`:
const changeAssignedSlotVars: ChangeAssignedSlotVariables = {
  containerID: ...,
  sourceSlotID: ...,
  targetSlotID: ...,
};

// Call the `changeAssignedSlotRef()` function to get a reference to the mutation.
const ref = changeAssignedSlotRef(changeAssignedSlotVars);
// Variables can be defined inline as well.
const ref = changeAssignedSlotRef({ containerID: ..., sourceSlotID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = changeAssignedSlotRef(dataConnect, changeAssignedSlotVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.binding);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.binding);
});
```

## DispatchProduct
You can execute the `DispatchProduct` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
dispatchProduct(vars: DispatchProductVariables): MutationPromise<DispatchProductData, DispatchProductVariables>;

interface DispatchProductRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: DispatchProductVariables): MutationRef<DispatchProductData, DispatchProductVariables>;
}
export const dispatchProductRef: DispatchProductRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
dispatchProduct(dc: DataConnect, vars: DispatchProductVariables): MutationPromise<DispatchProductData, DispatchProductVariables>;

interface DispatchProductRef {
  ...
  (dc: DataConnect, vars: DispatchProductVariables): MutationRef<DispatchProductData, DispatchProductVariables>;
}
export const dispatchProductRef: DispatchProductRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the dispatchProductRef:
```typescript
const name = dispatchProductRef.operationName;
console.log(name);
```

### Variables
The `DispatchProduct` mutation requires an argument of type `DispatchProductVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface DispatchProductVariables {
  containerID: string;
  sourceSlotID: number;
}
```
### Return Type
Recall that executing the `DispatchProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DispatchProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DispatchProductData {
  dispatch?: number | null;
}
```
### Using `DispatchProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, dispatchProduct, DispatchProductVariables } from '@dataconnect/example';

// The `DispatchProduct` mutation requires an argument of type `DispatchProductVariables`:
const dispatchProductVars: DispatchProductVariables = {
  containerID: ...,
  sourceSlotID: ...,
};

// Call the `dispatchProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await dispatchProduct(dispatchProductVars);
// Variables can be defined inline as well.
const { data } = await dispatchProduct({ containerID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await dispatchProduct(dataConnect, dispatchProductVars);

console.log(data.dispatch);

// Or, you can use the `Promise` API.
dispatchProduct(dispatchProductVars).then((response) => {
  const data = response.data;
  console.log(data.dispatch);
});
```

### Using `DispatchProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, dispatchProductRef, DispatchProductVariables } from '@dataconnect/example';

// The `DispatchProduct` mutation requires an argument of type `DispatchProductVariables`:
const dispatchProductVars: DispatchProductVariables = {
  containerID: ...,
  sourceSlotID: ...,
};

// Call the `dispatchProductRef()` function to get a reference to the mutation.
const ref = dispatchProductRef(dispatchProductVars);
// Variables can be defined inline as well.
const ref = dispatchProductRef({ containerID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = dispatchProductRef(dataConnect, dispatchProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.dispatch);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.dispatch);
});
```

## RecordExpiredScan
You can execute the `RecordExpiredScan` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
recordExpiredScan(vars: RecordExpiredScanVariables): MutationPromise<RecordExpiredScanData, RecordExpiredScanVariables>;

interface RecordExpiredScanRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RecordExpiredScanVariables): MutationRef<RecordExpiredScanData, RecordExpiredScanVariables>;
}
export const recordExpiredScanRef: RecordExpiredScanRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
recordExpiredScan(dc: DataConnect, vars: RecordExpiredScanVariables): MutationPromise<RecordExpiredScanData, RecordExpiredScanVariables>;

interface RecordExpiredScanRef {
  ...
  (dc: DataConnect, vars: RecordExpiredScanVariables): MutationRef<RecordExpiredScanData, RecordExpiredScanVariables>;
}
export const recordExpiredScanRef: RecordExpiredScanRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the recordExpiredScanRef:
```typescript
const name = recordExpiredScanRef.operationName;
console.log(name);
```

### Variables
The `RecordExpiredScan` mutation requires an argument of type `RecordExpiredScanVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RecordExpiredScanVariables {
  containerID: string;
  sourceSlotID?: number | null;
}
```
### Return Type
Recall that executing the `RecordExpiredScan` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RecordExpiredScanData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `RecordExpiredScan`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, recordExpiredScan, RecordExpiredScanVariables } from '@dataconnect/example';

// The `RecordExpiredScan` mutation requires an argument of type `RecordExpiredScanVariables`:
const recordExpiredScanVars: RecordExpiredScanVariables = {
  containerID: ...,
  sourceSlotID: ..., // optional
};

// Call the `recordExpiredScan()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await recordExpiredScan(recordExpiredScanVars);
// Variables can be defined inline as well.
const { data } = await recordExpiredScan({ containerID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await recordExpiredScan(dataConnect, recordExpiredScanVars);

console.log(data.query);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
recordExpiredScan(recordExpiredScanVars).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.activity_insert);
});
```

### Using `RecordExpiredScan`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, recordExpiredScanRef, RecordExpiredScanVariables } from '@dataconnect/example';

// The `RecordExpiredScan` mutation requires an argument of type `RecordExpiredScanVariables`:
const recordExpiredScanVars: RecordExpiredScanVariables = {
  containerID: ...,
  sourceSlotID: ..., // optional
};

// Call the `recordExpiredScanRef()` function to get a reference to the mutation.
const ref = recordExpiredScanRef(recordExpiredScanVars);
// Variables can be defined inline as well.
const ref = recordExpiredScanRef({ containerID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = recordExpiredScanRef(dataConnect, recordExpiredScanVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.query);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.query);
  console.log(data.activity_insert);
});
```


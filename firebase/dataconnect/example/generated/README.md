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
  - [*GetStockByProductID*](#getstockbyproductid)
- [**Mutations**](#mutations)
  - [*PlaceProduct*](#placeproduct)
  - [*TakeOffRack*](#takeoffrack)
  - [*ReturnProduct*](#returnproduct)
  - [*MoveProduct*](#moveproduct)
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
    productID?: string | null;
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
  productID: string;
}
```
### Return Type
Recall that executing the `GetProductContext` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetProductContextData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetProductContext`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getProductContext, GetProductContextVariables } from '@dataconnect/example';

// The `GetProductContext` query requires an argument of type `GetProductContextVariables`:
const getProductContextVars: GetProductContextVariables = {
  productID: ...,
};

// Call the `getProductContext()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getProductContext(getProductContextVars);
// Variables can be defined inline as well.
const { data } = await getProductContext({ productID: ..., });

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
  productID: ...,
};

// Call the `getProductContextRef()` function to get a reference to the query.
const ref = getProductContextRef(getProductContextVars);
// Variables can be defined inline as well.
const ref = getProductContextRef({ productID: ..., });

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
    productID?: string | null;
    assignedAt?: TimestampString | null;
    stock?: {
      productID: string;
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
  productID: string;
}
```
### Return Type
Recall that executing the `GetLocationSnapshot` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetLocationSnapshotData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetLocationSnapshot`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getLocationSnapshot, GetLocationSnapshotVariables } from '@dataconnect/example';

// The `GetLocationSnapshot` query requires an argument of type `GetLocationSnapshotVariables`:
const getLocationSnapshotVars: GetLocationSnapshotVariables = {
  productID: ...,
};

// Call the `getLocationSnapshot()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getLocationSnapshot(getLocationSnapshotVars);
// Variables can be defined inline as well.
const { data } = await getLocationSnapshot({ productID: ..., });

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
  productID: ...,
};

// Call the `getLocationSnapshotRef()` function to get a reference to the query.
const ref = getLocationSnapshotRef(getLocationSnapshotVars);
// Variables can be defined inline as well.
const ref = getLocationSnapshotRef({ productID: ..., });

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
  productID: string;
}
```
### Return Type
Recall that executing the `GetStockByProductID` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetStockByProductIdData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetStockByProductIdData {
  stock?: {
    productID: string;
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
  productID: ...,
};

// Call the `getStockByProductId()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getStockByProductId(getStockByProductIdVars);
// Variables can be defined inline as well.
const { data } = await getStockByProductId({ productID: ..., });

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
  productID: ...,
};

// Call the `getStockByProductIdRef()` function to get a reference to the query.
const ref = getStockByProductIdRef(getStockByProductIdVars);
// Variables can be defined inline as well.
const ref = getStockByProductIdRef({ productID: ..., });

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

## PlaceProduct
You can execute the `PlaceProduct` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
placeProduct(vars: PlaceProductVariables): MutationPromise<PlaceProductData, PlaceProductVariables>;

interface PlaceProductRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: PlaceProductVariables): MutationRef<PlaceProductData, PlaceProductVariables>;
}
export const placeProductRef: PlaceProductRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
placeProduct(dc: DataConnect, vars: PlaceProductVariables): MutationPromise<PlaceProductData, PlaceProductVariables>;

interface PlaceProductRef {
  ...
  (dc: DataConnect, vars: PlaceProductVariables): MutationRef<PlaceProductData, PlaceProductVariables>;
}
export const placeProductRef: PlaceProductRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the placeProductRef:
```typescript
const name = placeProductRef.operationName;
console.log(name);
```

### Variables
The `PlaceProduct` mutation requires an argument of type `PlaceProductVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface PlaceProductVariables {
  productID: string;
  targetSlotID: number;
}
```
### Return Type
Recall that executing the `PlaceProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `PlaceProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface PlaceProductData {
  stock_updateMany: number;
  slot_updateMany: number;
  activity_insert: Activity_Key;
}
```
### Using `PlaceProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, placeProduct, PlaceProductVariables } from '@dataconnect/example';

// The `PlaceProduct` mutation requires an argument of type `PlaceProductVariables`:
const placeProductVars: PlaceProductVariables = {
  productID: ...,
  targetSlotID: ...,
};

// Call the `placeProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await placeProduct(placeProductVars);
// Variables can be defined inline as well.
const { data } = await placeProduct({ productID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await placeProduct(dataConnect, placeProductVars);

console.log(data.stock_updateMany);
console.log(data.slot_updateMany);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
placeProduct(placeProductVars).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.slot_updateMany);
  console.log(data.activity_insert);
});
```

### Using `PlaceProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, placeProductRef, PlaceProductVariables } from '@dataconnect/example';

// The `PlaceProduct` mutation requires an argument of type `PlaceProductVariables`:
const placeProductVars: PlaceProductVariables = {
  productID: ...,
  targetSlotID: ...,
};

// Call the `placeProductRef()` function to get a reference to the mutation.
const ref = placeProductRef(placeProductVars);
// Variables can be defined inline as well.
const ref = placeProductRef({ productID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = placeProductRef(dataConnect, placeProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.stock_updateMany);
console.log(data.slot_updateMany);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.slot_updateMany);
  console.log(data.activity_insert);
});
```

## TakeOffRack
You can execute the `TakeOffRack` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
takeOffRack(vars: TakeOffRackVariables): MutationPromise<TakeOffRackData, TakeOffRackVariables>;

interface TakeOffRackRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: TakeOffRackVariables): MutationRef<TakeOffRackData, TakeOffRackVariables>;
}
export const takeOffRackRef: TakeOffRackRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
takeOffRack(dc: DataConnect, vars: TakeOffRackVariables): MutationPromise<TakeOffRackData, TakeOffRackVariables>;

interface TakeOffRackRef {
  ...
  (dc: DataConnect, vars: TakeOffRackVariables): MutationRef<TakeOffRackData, TakeOffRackVariables>;
}
export const takeOffRackRef: TakeOffRackRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the takeOffRackRef:
```typescript
const name = takeOffRackRef.operationName;
console.log(name);
```

### Variables
The `TakeOffRack` mutation requires an argument of type `TakeOffRackVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface TakeOffRackVariables {
  productID: string;
  sourceSlotID: number;
}
```
### Return Type
Recall that executing the `TakeOffRack` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `TakeOffRackData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface TakeOffRackData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}
```
### Using `TakeOffRack`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, takeOffRack, TakeOffRackVariables } from '@dataconnect/example';

// The `TakeOffRack` mutation requires an argument of type `TakeOffRackVariables`:
const takeOffRackVars: TakeOffRackVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `takeOffRack()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await takeOffRack(takeOffRackVars);
// Variables can be defined inline as well.
const { data } = await takeOffRack({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await takeOffRack(dataConnect, takeOffRackVars);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
takeOffRack(takeOffRackVars).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
});
```

### Using `TakeOffRack`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, takeOffRackRef, TakeOffRackVariables } from '@dataconnect/example';

// The `TakeOffRack` mutation requires an argument of type `TakeOffRackVariables`:
const takeOffRackVars: TakeOffRackVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `takeOffRackRef()` function to get a reference to the mutation.
const ref = takeOffRackRef(takeOffRackVars);
// Variables can be defined inline as well.
const ref = takeOffRackRef({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = takeOffRackRef(dataConnect, takeOffRackVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
});
```

## ReturnProduct
You can execute the `ReturnProduct` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
returnProduct(vars: ReturnProductVariables): MutationPromise<ReturnProductData, ReturnProductVariables>;

interface ReturnProductRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: ReturnProductVariables): MutationRef<ReturnProductData, ReturnProductVariables>;
}
export const returnProductRef: ReturnProductRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
returnProduct(dc: DataConnect, vars: ReturnProductVariables): MutationPromise<ReturnProductData, ReturnProductVariables>;

interface ReturnProductRef {
  ...
  (dc: DataConnect, vars: ReturnProductVariables): MutationRef<ReturnProductData, ReturnProductVariables>;
}
export const returnProductRef: ReturnProductRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the returnProductRef:
```typescript
const name = returnProductRef.operationName;
console.log(name);
```

### Variables
The `ReturnProduct` mutation requires an argument of type `ReturnProductVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface ReturnProductVariables {
  productID: string;
  sourceSlotID: number;
}
```
### Return Type
Recall that executing the `ReturnProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `ReturnProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface ReturnProductData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}
```
### Using `ReturnProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, returnProduct, ReturnProductVariables } from '@dataconnect/example';

// The `ReturnProduct` mutation requires an argument of type `ReturnProductVariables`:
const returnProductVars: ReturnProductVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `returnProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await returnProduct(returnProductVars);
// Variables can be defined inline as well.
const { data } = await returnProduct({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await returnProduct(dataConnect, returnProductVars);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
returnProduct(returnProductVars).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
});
```

### Using `ReturnProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, returnProductRef, ReturnProductVariables } from '@dataconnect/example';

// The `ReturnProduct` mutation requires an argument of type `ReturnProductVariables`:
const returnProductVars: ReturnProductVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `returnProductRef()` function to get a reference to the mutation.
const ref = returnProductRef(returnProductVars);
// Variables can be defined inline as well.
const ref = returnProductRef({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = returnProductRef(dataConnect, returnProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
});
```

## MoveProduct
You can execute the `MoveProduct` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [generated/index.d.ts](./index.d.ts):
```typescript
moveProduct(vars: MoveProductVariables): MutationPromise<MoveProductData, MoveProductVariables>;

interface MoveProductRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: MoveProductVariables): MutationRef<MoveProductData, MoveProductVariables>;
}
export const moveProductRef: MoveProductRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
moveProduct(dc: DataConnect, vars: MoveProductVariables): MutationPromise<MoveProductData, MoveProductVariables>;

interface MoveProductRef {
  ...
  (dc: DataConnect, vars: MoveProductVariables): MutationRef<MoveProductData, MoveProductVariables>;
}
export const moveProductRef: MoveProductRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the moveProductRef:
```typescript
const name = moveProductRef.operationName;
console.log(name);
```

### Variables
The `MoveProduct` mutation requires an argument of type `MoveProductVariables`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface MoveProductVariables {
  productID: string;
  sourceSlotID: number;
  targetSlotID: number;
}
```
### Return Type
Recall that executing the `MoveProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `MoveProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface MoveProductData {
  stock_updateMany: number;
  source: number;
  target: number;
  activity_insert: Activity_Key;
}
```
### Using `MoveProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, moveProduct, MoveProductVariables } from '@dataconnect/example';

// The `MoveProduct` mutation requires an argument of type `MoveProductVariables`:
const moveProductVars: MoveProductVariables = {
  productID: ...,
  sourceSlotID: ...,
  targetSlotID: ...,
};

// Call the `moveProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await moveProduct(moveProductVars);
// Variables can be defined inline as well.
const { data } = await moveProduct({ productID: ..., sourceSlotID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await moveProduct(dataConnect, moveProductVars);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.target);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
moveProduct(moveProductVars).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.target);
  console.log(data.activity_insert);
});
```

### Using `MoveProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, moveProductRef, MoveProductVariables } from '@dataconnect/example';

// The `MoveProduct` mutation requires an argument of type `MoveProductVariables`:
const moveProductVars: MoveProductVariables = {
  productID: ...,
  sourceSlotID: ...,
  targetSlotID: ...,
};

// Call the `moveProductRef()` function to get a reference to the mutation.
const ref = moveProductRef(moveProductVars);
// Variables can be defined inline as well.
const ref = moveProductRef({ productID: ..., sourceSlotID: ..., targetSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = moveProductRef(dataConnect, moveProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.target);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.target);
  console.log(data.activity_insert);
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
  productID: string;
  sourceSlotID: number;
}
```
### Return Type
Recall that executing the `DispatchProduct` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `DispatchProductData`, which is defined in [generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface DispatchProductData {
  stock_updateMany: number;
  source: number;
  activity_insert: Activity_Key;
}
```
### Using `DispatchProduct`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, dispatchProduct, DispatchProductVariables } from '@dataconnect/example';

// The `DispatchProduct` mutation requires an argument of type `DispatchProductVariables`:
const dispatchProductVars: DispatchProductVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `dispatchProduct()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await dispatchProduct(dispatchProductVars);
// Variables can be defined inline as well.
const { data } = await dispatchProduct({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await dispatchProduct(dataConnect, dispatchProductVars);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
dispatchProduct(dispatchProductVars).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
});
```

### Using `DispatchProduct`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, dispatchProductRef, DispatchProductVariables } from '@dataconnect/example';

// The `DispatchProduct` mutation requires an argument of type `DispatchProductVariables`:
const dispatchProductVars: DispatchProductVariables = {
  productID: ...,
  sourceSlotID: ...,
};

// Call the `dispatchProductRef()` function to get a reference to the mutation.
const ref = dispatchProductRef(dispatchProductVars);
// Variables can be defined inline as well.
const ref = dispatchProductRef({ productID: ..., sourceSlotID: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = dispatchProductRef(dataConnect, dispatchProductVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.stock_updateMany);
console.log(data.source);
console.log(data.activity_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.stock_updateMany);
  console.log(data.source);
  console.log(data.activity_insert);
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
  productID: string;
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
  productID: ...,
  sourceSlotID: ..., // optional
};

// Call the `recordExpiredScan()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await recordExpiredScan(recordExpiredScanVars);
// Variables can be defined inline as well.
const { data } = await recordExpiredScan({ productID: ..., sourceSlotID: ..., });

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
  productID: ...,
  sourceSlotID: ..., // optional
};

// Call the `recordExpiredScanRef()` function to get a reference to the mutation.
const ref = recordExpiredScanRef(recordExpiredScanVars);
// Variables can be defined inline as well.
const ref = recordExpiredScanRef({ productID: ..., sourceSlotID: ..., });

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


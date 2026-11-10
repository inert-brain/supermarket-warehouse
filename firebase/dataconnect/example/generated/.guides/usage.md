# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { placeProduct, takeOffRack, returnProduct, moveProduct, dispatchProduct, recordExpiredScan, getSlotBindings, getProductContext, getSlotMenu, getLocationSnapshot } from '@dataconnect/example';


// Operation PlaceProduct:  For variables, look at type PlaceProductVars in ../index.d.ts
const { data } = await PlaceProduct(dataConnect, placeProductVars);

// Operation TakeOffRack:  For variables, look at type TakeOffRackVars in ../index.d.ts
const { data } = await TakeOffRack(dataConnect, takeOffRackVars);

// Operation ReturnProduct:  For variables, look at type ReturnProductVars in ../index.d.ts
const { data } = await ReturnProduct(dataConnect, returnProductVars);

// Operation MoveProduct:  For variables, look at type MoveProductVars in ../index.d.ts
const { data } = await MoveProduct(dataConnect, moveProductVars);

// Operation DispatchProduct:  For variables, look at type DispatchProductVars in ../index.d.ts
const { data } = await DispatchProduct(dataConnect, dispatchProductVars);

// Operation RecordExpiredScan:  For variables, look at type RecordExpiredScanVars in ../index.d.ts
const { data } = await RecordExpiredScan(dataConnect, recordExpiredScanVars);

// Operation GetSlotBindings:
const { data } = await GetSlotBindings(dataConnect);

// Operation GetProductContext:  For variables, look at type GetProductContextVars in ../index.d.ts
const { data } = await GetProductContext(dataConnect, getProductContextVars);

// Operation GetSlotMenu:
const { data } = await GetSlotMenu(dataConnect);

// Operation GetLocationSnapshot:  For variables, look at type GetLocationSnapshotVars in ../index.d.ts
const { data } = await GetLocationSnapshot(dataConnect, getLocationSnapshotVars);


```
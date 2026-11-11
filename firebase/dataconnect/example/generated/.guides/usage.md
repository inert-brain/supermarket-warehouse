# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { registerScannedProduct, reportSlotOccupancy, assignProductToSlot, changeAssignedSlot, dispatchProduct, recordExpiredScan, getSlotBindings, getProductContext, getSlotMenu, getLocationSnapshot } from '@dataconnect/example';


// Operation RegisterScannedProduct:  For variables, look at type RegisterScannedProductVars in ../index.d.ts
const { data } = await RegisterScannedProduct(dataConnect, registerScannedProductVars);

// Operation ReportSlotOccupancy:  For variables, look at type ReportSlotOccupancyVars in ../index.d.ts
const { data } = await ReportSlotOccupancy(dataConnect, reportSlotOccupancyVars);

// Operation AssignProductToSlot:  For variables, look at type AssignProductToSlotVars in ../index.d.ts
const { data } = await AssignProductToSlot(dataConnect, assignProductToSlotVars);

// Operation ChangeAssignedSlot:  For variables, look at type ChangeAssignedSlotVars in ../index.d.ts
const { data } = await ChangeAssignedSlot(dataConnect, changeAssignedSlotVars);

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
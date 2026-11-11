// Compile-time checks against real generated declarations, not handwritten SDK types.
import type { DataConnect } from 'firebase/data-connect';
import {
  reportSlotOccupancy, assignProductToSlot, changeAssignedSlot, dispatchProduct,
  recordExpiredScan, getLocationSnapshot, getProductContext, getSlotMenu, getSlotBindings,
  type ReportSlotOccupancyVariables, type AssignProductToSlotVariables,
  type ChangeAssignedSlotVariables, type DispatchProductVariables,
  type RecordExpiredScanVariables, type ReportSlotOccupancyData,
  type AssignProductToSlotData, type ChangeAssignedSlotData, type DispatchProductData,
  type StockStatus,
} from './example/generated';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type ReportInput = Assert<Equal<ReportSlotOccupancyVariables, { slotID: number; occupied: boolean }>>;
type AssignInput = Assert<Equal<AssignProductToSlotVariables, { productID: string; targetSlotID: number }>>;
type ChangeInput = Assert<Equal<ChangeAssignedSlotVariables, { productID: string; sourceSlotID: number; targetSlotID: number }>>;
type DispatchInput = Assert<Equal<DispatchProductVariables, { productID: string; sourceSlotID: number }>>;
type ExpiredInput = Assert<Equal<RecordExpiredScanVariables, { productID: string; sourceSlotID?: number | null }>>;
type ReportSlot = NonNullable<NonNullable<ReportSlotOccupancyData['query']>['slot']>;
type NullableOccupancy = Assert<Equal<ReportSlot['isOccupied'], boolean | null | undefined>>;
type NullableObservationTime = Assert<Equal<ReportSlot['occupancyUpdatedAt'], string | null | undefined>>;
type AssignResult = Assert<Equal<AssignProductToSlotData, { binding?: number | null }>>;
type ChangeResult = Assert<Equal<ChangeAssignedSlotData, { binding?: number | null }>>;
type DispatchResult = Assert<Equal<DispatchProductData, { dispatch?: number | null }>>;
type SensorStatus = Assert<Equal<NonNullable<ReportSlot['stock']>['currentStatus'], StockStatus>>;
type StockStatuses = Assert<Equal<`${StockStatus}`, 'EMPTY' | 'OCCUPIED' | 'PENDING_DISPATCH'>>;

async function contracts(dc: DataConnect) {
  const report = await reportSlotOccupancy(dc, { slotID: 1, occupied: true });
  const count: number | null | undefined = report.data.observation;
  const occupied: boolean | null | undefined = report.data.query?.slot?.isOccupied;
  const status = report.data.query?.slot?.stock?.currentStatus;
  await assignProductToSlot(dc, { productID: '001', targetSlotID: 1 });
  await changeAssignedSlot(dc, { productID: '001', sourceSlotID: 1, targetSlotID: 2 });
  await dispatchProduct(dc, { productID: '001', sourceSlotID: 2 });
  await recordExpiredScan(dc, { productID: '001', sourceSlotID: null });
  const snapshot = await getLocationSnapshot(dc, { productID: '001' });
  const context = await getProductContext(dc, { productID: '001' });
  const menu = await getSlotMenu(dc);
  const bindings = await getSlotBindings(dc);
  for (const row of [...snapshot.data.rackSlots, ...snapshot.data.productBindings, ...context.data.slots, ...menu.data.slots, ...bindings.data.slots]) {
    const sensor: boolean | null | undefined = row.isOccupied;
    const observedAt: string | null | undefined = row.occupancyUpdatedAt;
    void [sensor, observedAt];
  }
  // @ts-expect-error Reports accept no product identity from the sensor.
  await reportSlotOccupancy(dc, { slotID: 1, occupied: true, productID: '001' });
  // @ts-expect-error Slot IDs are numbers; product IDs stay exact strings.
  await assignProductToSlot(dc, { productID: 1, targetSlotID: '1' });
  void [count, occupied, status];
}
void contracts;

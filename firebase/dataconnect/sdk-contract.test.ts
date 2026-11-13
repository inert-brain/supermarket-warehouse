// Compile-time checks against real generated declarations, not handwritten SDK types.
import type { DataConnect } from 'firebase/data-connect';
import {
  registerScannedProduct, type RegisterScannedProductVariables, type RegisterScannedProductData,
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
type RegistrationInput = Assert<Equal<RegisterScannedProductVariables, { containerID: string }>>;
type RegistrationResult = Assert<Equal<RegisterScannedProductData, { registration?: number | null }>>;
type ReportInput = Assert<Equal<ReportSlotOccupancyVariables, { slotID: number; occupied: boolean }>>;
type AssignInput = Assert<Equal<AssignProductToSlotVariables, { containerID: string; targetSlotID: number }>>;
type ChangeInput = Assert<Equal<ChangeAssignedSlotVariables, { containerID: string; sourceSlotID: number; targetSlotID: number }>>;
type DispatchInput = Assert<Equal<DispatchProductVariables, { containerID: string; sourceSlotID: number }>>;
type ExpiredInput = Assert<Equal<RecordExpiredScanVariables, { containerID: string; sourceSlotID?: number | null }>>;
type ReportSlot = NonNullable<NonNullable<ReportSlotOccupancyData['query']>['slot']>;
type NullableOccupancy = Assert<Equal<ReportSlot['isOccupied'], boolean | null | undefined>>;
type NullableObservationTime = Assert<Equal<ReportSlot['occupancyUpdatedAt'], string | null | undefined>>;
type AssignResult = Assert<Equal<AssignProductToSlotData, { binding?: number | null }>>;
type ChangeResult = Assert<Equal<ChangeAssignedSlotData, { binding?: number | null }>>;
type DispatchResult = Assert<Equal<DispatchProductData, { dispatch?: number | null }>>;
type SensorStatus = Assert<Equal<NonNullable<ReportSlot['stock']>['currentStatus'], StockStatus>>;
type StockStatuses = Assert<Equal<`${StockStatus}`, 'EMPTY' | 'OCCUPIED' | 'PENDING_DISPATCH'>>;

async function contracts(dc: DataConnect) {
  const registration = await registerScannedProduct(dc, { containerID: '000001' });
  const registered: number | null | undefined = registration.data.registration;
  // @ts-expect-error Registration preserves string IDs, including leading zeros.
  await registerScannedProduct(dc, { containerID: 1 });
  void registered;
  const report = await reportSlotOccupancy(dc, { slotID: 1, occupied: true });
  const count: number | null | undefined = report.data.observation;
  const occupied: boolean | null | undefined = report.data.query?.slot?.isOccupied;
  const status = report.data.query?.slot?.stock?.currentStatus;
  await assignProductToSlot(dc, { containerID: '001', targetSlotID: 1 });
  await changeAssignedSlot(dc, { containerID: '001', sourceSlotID: 1, targetSlotID: 2 });
  await dispatchProduct(dc, { containerID: '001', sourceSlotID: 2 });
  await recordExpiredScan(dc, { containerID: '001', sourceSlotID: null });
  const snapshot = await getLocationSnapshot(dc, { containerID: '001' });
  const context = await getProductContext(dc, { containerID: '001' });
  const menu = await getSlotMenu(dc);
  const bindings = await getSlotBindings(dc);
  for (const row of [...snapshot.data.rackSlots, ...snapshot.data.productBindings, ...context.data.slots, ...menu.data.slots, ...bindings.data.slots]) {
    const sensor: boolean | null | undefined = row.isOccupied;
    const observedAt: string | null | undefined = row.occupancyUpdatedAt;
    void [sensor, observedAt];
  }
  // @ts-expect-error Reports accept no product identity from the sensor.
  await reportSlotOccupancy(dc, { slotID: 1, occupied: true, containerID: '001' });
  // @ts-expect-error Slot IDs are numbers; container IDs stay exact strings.
  await assignProductToSlot(dc, { containerID: 1, targetSlotID: '1' });
  void [count, occupied, status];
}
void contracts;

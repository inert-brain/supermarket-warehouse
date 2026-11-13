import test from 'node:test';
import assert from 'node:assert/strict';
import { actionForSlot, canDispatch, makeCommand, slotState, transitionEffects, validateSnapshot } from './location/core.ts';

function snapshot(status = 'EMPTY', expiry = 'valid', assigned = status !== 'EMPTY') {
  return { product: { containerID: '001', status, expiry }, slots: Array.from({ length: 8 }, (_, i) => ({
    slotId: i + 1, containerID: i === 0 && assigned ? '001' : null,
    assignedAt: i === 0 && assigned ? '2026-01-01' : null, status: i === 0 && assigned ? status : null,
    isOccupied: i === 0 && assigned && status === 'OCCUPIED', occupancyUpdatedAt: '2020-01-01T00:00:00Z',
  })) };
}

const statuses = ['EMPTY', 'PENDING_DISPATCH', 'OCCUPIED'];

test('assignment effects preserve every accepted stock status, history and warehouse count', () => {
  assert.deepEqual(Object.values(transitionEffects).map(x => [x.to, x.activity, x.warehouse]), [
    ['unchanged', null, 0], ['unchanged', null, 0], ['EMPTY', 'DISPATCHED', 'derive'], ['unchanged', 'REMOVED', 0],
  ]);
  for (const action of ['AssignProductToSlot', 'ChangeAssignedSlot', 'DispatchProduct']) {
    assert.deepEqual([...transitionEffects[action].from].sort(), [...statuses].sort());
  }
});

test('slot labels use saved occupancy and assignment, not sensor age or stock agreement', () => {
  const vacant = snapshot().slots[0];
  for (const [changes, state] of [
    [{}, 'available'], [{ isOccupied: null, occupancyUpdatedAt: null }, 'available'],
    [{ isOccupied: true }, 'unidentified'],
    [{ containerID: 'x', status: 'EMPTY' }, 'awaiting'],
    [{ containerID: 'x', status: 'PENDING_DISPATCH' }, 'reserved'],
    [{ containerID: 'x', status: 'OCCUPIED' }, 'reserved'],
    [{ containerID: 'x', status: 'OCCUPIED', isOccupied: null }, 'unknown'],
    ...statuses.map(status => [{ containerID: 'x', status, isOccupied: true }, 'occupied']),
  ]) assert.equal(slotState({ ...vacant, ...changes }), state);
});

test('all valid unassigned stocks can select false/null targets with old, future or absent timestamps', () => {
  for (const expiry of ['valid', 'unknown']) for (const status of statuses) for (const isOccupied of [false, null]) {
    for (const occupancyUpdatedAt of [null, '2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z']) {
      const data = snapshot(status, expiry, false);
      Object.assign(data.slots[0], { isOccupied, occupancyUpdatedAt });
      const before = structuredClone(data);
      assert.equal(validateSnapshot(data, '001'), data);
      assert.equal(slotState(data.slots[0]), 'available');
      assert.deepEqual(makeCommand(data, 'AssignProductToSlot', 1), { action: 'AssignProductToSlot', containerID: '001', sourceSlotID: null, targetSlotID: 1 });
      assert.equal(canDispatch(data), false);
      assert.deepEqual(data, before);
    }
  }
});

test('false/null assigned source can move regardless of stock; its own slot is always a no-op', () => {
  for (const expiry of ['valid', 'unknown']) for (const status of statuses) for (const isOccupied of [false, null]) {
    const data = snapshot(status, expiry, true);
    data.slots[0].isOccupied = isOccupied;
    data.slots[1].isOccupied = null;
    data.slots[1].occupancyUpdatedAt = null;
    const before = structuredClone(data);
    assert.equal(validateSnapshot(data, '001'), data);
    assert.equal(actionForSlot(data, 1), null);
    assert.equal(actionForSlot(data, 2), 'ChangeAssignedSlot');
    assert.deepEqual(makeCommand(data, 'ChangeAssignedSlot', 2), { action: 'ChangeAssignedSlot', containerID: '001', sourceSlotID: 1, targetSlotID: 2 });
    assert.throws(() => makeCommand(data, 'AssignProductToSlot', 2));
    assert.deepEqual(data, before);
  }
});

test('known occupied sources and targets block assignment even when old or stock disagrees', () => {
  for (const status of statuses) {
    const data = snapshot(status, 'valid', true);
    data.slots[0].isOccupied = true;
    data.slots[0].occupancyUpdatedAt = null;
    assert.equal(actionForSlot(data, 1), null);
    assert.equal(actionForSlot(data, 2), null);
    assert.throws(() => makeCommand(data, 'ChangeAssignedSlot', 2));
    data.slots[0].isOccupied = false;
    data.slots[1].isOccupied = true;
    assert.equal(actionForSlot(data, 2), null);
    assert.throws(() => makeCommand(data, 'ChangeAssignedSlot', 2));
  }
  const data = snapshot(); data.slots[0].isOccupied = true;
  assert.equal(actionForSlot(data, 1), null);
  assert.throws(() => makeCommand(data, 'AssignProductToSlot', 1));
});

test('other products remain reserved for all stock and occupancy combinations', () => {
  for (const status of statuses) for (const isOccupied of [true, false, null]) {
    const data = snapshot();
    data.slots[1] = { ...data.slots[1], containerID: 'other', assignedAt: 'now', status, isOccupied };
    assert.equal(actionForSlot(data, 2), null);
  }
});

test('dispatch permits false or unknown occupancy for an assigned valid product', () => {
  for (const expiry of ['valid', 'unknown']) for (const status of statuses) for (const isOccupied of [false, null]) for (const occupancyUpdatedAt of [null, '2000-01-01T00:00:00Z', '2099-01-01T00:00:00Z']) {
    const data = snapshot(status, expiry, true);
    Object.assign(data.slots[0], { isOccupied, occupancyUpdatedAt });
    assert.equal(canDispatch(data), true);
    assert.deepEqual(makeCommand(data, 'DispatchProduct'), { action: 'DispatchProduct', containerID: '001', sourceSlotID: 1, targetSlotID: null });
    data.slots[0].isOccupied = true;
    assert.equal(canDispatch(data), false);
    assert.throws(() => makeCommand(data, 'DispatchProduct'));
    assert.equal(canDispatch(snapshot(status, expiry, false)), false);
  }
});

test('phone expiry still blocks normal assignment and dispatch; expired logging does not alter inventory', () => {
  for (const expiry of ['expired']) {
    for (const status of statuses) for (const assigned of [false, true]) {
      const data = snapshot(status, expiry, assigned); data.slots[0].isOccupied = false;
      assert.equal(actionForSlot(data, 2), null);
      assert.throws(() => makeCommand(data, assigned ? 'ChangeAssignedSlot' : 'AssignProductToSlot', 2));
      assert.equal(canDispatch(data), false);
      assert.throws(() => makeCommand(data, 'DispatchProduct'));
    }
  }
  for (const state of statuses) {
    const data = snapshot(state, 'expired');
    data.slots.forEach(slot => { slot.isOccupied = null; slot.occupancyUpdatedAt = null; });
    const before = structuredClone(data);
    assert.deepEqual(makeCommand(data, 'RecordExpiredScan'), { action: 'RecordExpiredScan', containerID: '001', sourceSlotID: state === 'EMPTY' ? null : 1, targetSlotID: null });
    assert.deepEqual(data, before);
  }
  assert.throws(() => makeCommand(snapshot(), 'RecordExpiredScan'));
  for (const old of ['PlaceProduct', 'MoveProduct', 'TakeOffRack', 'ReturnProduct']) assert.throws(() => makeCommand(snapshot(), old, 1));
});

test('structural and actual join inconsistencies still fail closed without repairs', () => {
  const mutations = [
    data => { data.slots.pop(); }, data => { data.slots[1].slotId = 1; },
    data => { data.slots[0].slotId = 9; }, data => { data.slots[0].containerID = null; },
    data => { data.slots[0].status = 'EMPTY'; }, data => { data.slots[0].assignedAt = null; },
    data => { data.slots[1] = { ...data.slots[0], slotId: 2 }; },
    data => { delete data.slots[1].isOccupied; }, data => { delete data.slots[1].occupancyUpdatedAt; },
    data => { data.slots[1].isOccupied = 'false'; }, data => { data.slots[1].occupancyUpdatedAt = 'bad'; },
    data => { data.product.status = 'bad'; }, data => { data.product.expiry = 'bad'; },
  ];
  for (const mutate of mutations) {
    const data = snapshot('PENDING_DISPATCH'); mutate(data);
    const before = structuredClone(data);
    assert.throws(() => validateSnapshot(data, '001'));
    assert.deepEqual(data, before);
  }
  assert.throws(() => validateSnapshot(snapshot(), '1'));
  const data = snapshot(); data.product.containerID = '';
  assert.throws(() => validateSnapshot(data, ''));
});

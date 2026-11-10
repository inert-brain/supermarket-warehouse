import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { actionForSlot, makeCommand, validateSnapshot, type Action, type Command, type Snapshot } from './core';
import { locationAdapter, type LocationAdapter } from './adapter';

export function LocationWorkflow({ productID, adapter = locationAdapter }: { productID: string; adapter?: LocationAdapter | null }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('Loading inventory…');
  const [pending, setPending] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const expiredRecorded = useRef(false);

  const refresh = useCallback(async () => {
    if (!adapter) { setMessage('Location operations unavailable: a safe connector adapter is not configured. No changes were made.'); return false; }
    const current = ++generation.current;
    const controller = new AbortController();
    setSnapshot(null);
    try {
      const saved = await adapter.pending();
      if (current !== generation.current) return false;
      setPending(saved);
      const result = await adapter.read(productID, controller.signal);
      if (current !== generation.current) return false;
      if (!result) { setMessage('Product not found. No changes were made.'); return false; }
      setSnapshot(validateSnapshot(result, productID));
      setMessage(saved ? 'An earlier operation needs reconciliation before any new action.' : 'Staff-confirmed inventory; not sensor-verified.');
      return true;
    } catch (error) {
      if (current === generation.current) setMessage(error instanceof Error ? error.message : 'Could not load inventory. Retry.');
      return false;
    }
  }, [adapter, productID]);

  useEffect(() => {
    let mounted = true;
    const counter = generation;
    void Promise.resolve().then(() => { if (mounted) void refresh(); });
    return () => { mounted = false; counter.current++; };
  }, [refresh]);

  const finish = useCallback(async (command: Command, reconcile: boolean) => {
    if (!adapter) return;
    const result = reconcile ? await adapter.resolve(command) : await adapter.submit(command);
    if (!result) { setMessage('Outcome unknown. Reconcile or retry this same operation; do not start another action.'); return; }
    await adapter.clear(command.operationID);
    setPending(null);
    const refreshed = await refresh();
    if (refreshed) setMessage(result.status === 'committed' ? `Committed: ${result.message}` : `Conflict: ${result.message}`);
  }, [adapter, refresh]);

  const run = useCallback(async (action: Action, targetId?: number) => {
    if (!adapter || !snapshot || pending || lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const draft = makeCommand(snapshot, action, 'prepare', targetId);
      const { operationID: _ignored, ...payload } = draft;
      const command = await adapter.prepare(payload);
      setPending(command);
      await finish(command, false);
    } catch (error) {
      // prepare may have persisted before failing; refresh discovers the journal entry.
      await refresh();
      setMessage(`Operation not confirmed. ${error instanceof Error ? error.message : 'Check the connection.'} Reconcile any pending operation before continuing.`);
    } finally { lock.current = false; setBusy(false); }
  }, [adapter, snapshot, pending, finish, refresh]);

  useEffect(() => {
    if (snapshot?.product.expiry === 'expired' && !pending && !busy && !expiredRecorded.current && adapter) {
      expiredRecorded.current = true;
      void run('RecordExpiredScan');
    }
  }, [snapshot, pending, busy, adapter, run]);

  async function recover(retry: boolean) {
    if (!pending || !adapter || lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await finish(pending, !retry); }
    catch { setMessage('Outcome still unknown. The original operation remains pending; retry or reconcile it.'); }
    finally { lock.current = false; setBusy(false); }
  }

  function confirm(action: Action, targetId?: number) {
    const description = action === 'DispatchProduct' ? 'Confirm this product has left the warehouse. This releases its slot.' :
      action === 'TakeOffRack' ? 'Confirm the product was taken off its rack. Its slot remains reserved.' :
      `${action === 'PlaceProduct' ? 'Place' : action === 'ReturnProduct' ? 'Return' : 'Move'} ${productID} ${action === 'ReturnProduct' ? 'to its reserved slot' : `to slot ${targetId}`}?`;
    Alert.alert('Staff confirmation', description, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: () => void run(action, targetId) }]);
  }

  return <View style={styles.panel}>
    <Text style={styles.heading}>Location workflow</Text>
    <Text>{message}</Text>
    {busy && <ActivityIndicator accessibilityLabel="Processing operation" />}
    {pending && <View><Text>Pending {pending.action}: {pending.operationID} ({pending.productID})</Text>
      <Button title="Check operation outcome" disabled={busy} onPress={() => void recover(false)} />
      <Button title="Retry same operation" disabled={busy} onPress={() => void recover(true)} /></View>}
    {snapshot && <>
      <Text>Stock: {snapshot.product.status} · Expiry: {snapshot.product.expiry}</Text>
      {snapshot.product.expiry === 'expired' && <Text>Expired: do not proceed. Ask staff for guidance; disposal is not supported. The scan event is recorded only after confirmation.</Text>}
      {snapshot.product.expiry === 'unknown' && <Text>Verify expiry before placement, return, move, or dispatch.</Text>}
      <View style={styles.grid}>{[...snapshot.slots].sort((a, b) => a.slotId - b.slotId).map(slot => {
        const action = actionForSlot(snapshot, slot.slotId);
        const enabled = !!action && !busy && !pending;
        const label = slot.productID === null ? 'Available' : slot.status === 'OCCUPIED' ? 'On rack' : 'Off rack—reserved';
        return <Pressable key={slot.slotId} accessibilityRole="button" accessibilityLabel={`Slot ${slot.slotId}, ${label}, ${slot.productID ?? 'unassigned'}`} accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={() => action && confirm(action, slot.slotId)} style={[styles.slot, slot.productID === null && styles.available]}>
          <Text>Slot {slot.slotId}</Text><Text>{label}</Text><Text>{slot.productID ?? 'Unassigned'}</Text>
        </Pressable>;
      })}</View>
      <Button title="Take off rack" disabled={busy || !!pending || snapshot.product.status !== 'OCCUPIED'} onPress={() => confirm('TakeOffRack')} />
      <Button title="Remove Product (external dispatch)" disabled={busy || !!pending || snapshot.product.status !== 'PENDING_DISPATCH' || snapshot.product.expiry !== 'valid'} onPress={() => confirm('DispatchProduct')} />
    </>}
    <Button title="Refresh inventory" disabled={busy} onPress={() => void refresh()} />
  </View>;
}

const styles = StyleSheet.create({
  panel: { width: '100%', marginTop: 20, gap: 8 }, heading: { fontSize: 18, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '25%', minHeight: 80, padding: 5, backgroundColor: '#dedede', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  available: { backgroundColor: '#b6e5bd' },
});

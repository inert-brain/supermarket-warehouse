import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { actionForSlot, makeCommand, validateSnapshot, type Action, type Snapshot } from './core';
import { locationAdapter, type LocationAdapter } from './adapter';

export function LocationWorkflow({ productID, adapter = locationAdapter, onBusyChange }: { productID: string; adapter?: LocationAdapter | null; onBusyChange?: (busy: boolean) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('Loading inventory…');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const expiredRecorded = useRef(false);
  const uncertain = useRef<string | null>(null);

  const setWorking = useCallback((value: boolean) => {
    setBusy(value);
    onBusyChange?.(value);
  }, [onBusyChange]);

  const release = useCallback(() => {
    lock.current = false;
    if (active.current) setWorking(false);
  }, [setWorking]);

  const refresh = useCallback(async () => {
    if (!adapter) { setMessage('Location operations unavailable: a connector adapter is not configured. No changes were made.'); return false; }
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSnapshot(null);
    setMessage('Loading inventory…');
    try {
      const result = await adapter.read(productID, controller.signal);
      if (!active.current || current !== generation.current) return false;
      if (!result) { setMessage(uncertain.current ?? 'Product not found. No changes were made.'); return false; }
      setSnapshot(validateSnapshot(result, productID));
      setMessage(uncertain.current ?? (adapter.writesEnabled ? 'Staff-confirmed inventory; not sensor-verified.' : 'Read-only: location writes are unavailable.'));
      return true;
    } catch (error) {
      if (active.current && current === generation.current) {
        const detail = error instanceof Error ? error.message : 'Could not load inventory. Refresh to check state.';
        setMessage(uncertain.current ? `${uncertain.current} Inventory refresh failed: ${detail}` : detail);
      }
      return false;
    } finally { if (request.current === controller) request.current = null; }
  }, [adapter, productID]);

  const reload = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setWorking(true);
    try { await refresh(); }
    finally { release(); }
  }, [refresh, release, setWorking]);

  useEffect(() => {
    active.current = true;
    let mounted = true;
    const counter = generation;
    void Promise.resolve().then(() => { if (mounted) void reload(); });
    return () => {
      mounted = false;
      active.current = false;
      counter.current++;
      request.current?.abort();
      onBusyChange?.(false);
    };
  }, [reload, onBusyChange]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void reload();
    });
    return () => subscription.remove();
  }, [reload]);

  // Callers hold the tap lock through confirmation, mutation, and the final refresh.
  const execute = useCallback(async (action: Action, targetId?: number) => {
    const current = generation.current;
    try {
      if (!adapter?.writesEnabled || !snapshot) return;
      const command = makeCommand(snapshot, action, targetId);
      uncertain.current = null;
      const result = await adapter.submit(command);
      if (!active.current || current !== generation.current) return;
      const refreshed = await refresh();
      if (active.current) setMessage(refreshed ? result.message : `${result.message} Refresh inventory to check the current state.`);
    } catch (error) {
      if (!active.current || current !== generation.current) return;
      uncertain.current = `Outcome not confirmed. ${error instanceof Error ? error.message : 'Check the connection.'} Check the current inventory and physical product before taking another action. The request may still complete; it was not automatically retried.`;
      await refresh();
    } finally { release(); }
  }, [adapter, snapshot, refresh, release]);

  useEffect(() => {
    if (snapshot?.product.expiry === 'expired' && !busy && !lock.current && !expiredRecorded.current && adapter?.writesEnabled) {
      // One attempt per deliberate scan, including when its response is lost.
      expiredRecorded.current = true;
      lock.current = true;
      setWorking(true);
      void execute('RecordExpiredScan');
    }
  }, [snapshot, busy, adapter, execute, setWorking]);

  function confirm(action: Action, targetId?: number) {
    if (!adapter?.writesEnabled || !snapshot || lock.current) return;
    lock.current = true;
    setWorking(true);
    const current = generation.current;
    let open = true;
    const cancel = () => { if (open) { open = false; release(); } };
    const description = action === 'DispatchProduct' ? 'Confirm this product has left the warehouse. This releases its slot.' :
      action === 'TakeOffRack' ? 'Confirm the product was taken off its rack. Its slot remains reserved.' :
      `${action === 'PlaceProduct' ? 'Place' : action === 'ReturnProduct' ? 'Return' : 'Move'} ${productID} ${action === 'ReturnProduct' ? 'to its reserved slot' : `to slot ${targetId}`}?`;
    Alert.alert('Staff confirmation', description, [
      { text: 'Cancel', style: 'cancel', onPress: cancel },
      { text: 'Confirm', onPress: () => {
        if (!open) return;
        open = false;
        if (!active.current || current !== generation.current) { release(); return; }
        void execute(action, targetId);
      } },
    ], { cancelable: true, onDismiss: cancel });
  }

  return <View style={styles.panel}>
    <Text style={styles.heading}>Location workflow</Text>
    <Text>{message}</Text>
    {busy && <ActivityIndicator accessibilityLabel="Processing operation" />}
    {snapshot && <>
      <Text>Stock: {snapshot.product.status} · Expiry: {snapshot.product.expiry}</Text>
      {snapshot.product.expiry === 'expired' && <Text>Expired: do not place, return, move, or dispatch. Taking it off rack keeps its slot reserved; disposal is not supported.</Text>}
      {snapshot.product.expiry === 'unknown' && <Text>Verify expiry before placement, return, move, or dispatch.</Text>}
      <View style={styles.grid}>{[...snapshot.slots].sort((a, b) => a.slotId - b.slotId).map(slot => {
        const action = actionForSlot(snapshot, slot.slotId);
        const enabled = !!action && !!adapter?.writesEnabled && !busy;
        const label = slot.productID === null ? 'Available' : slot.status === 'OCCUPIED' ? 'On rack' : 'Off rack—reserved';
        return <Pressable key={slot.slotId} accessibilityRole="button" accessibilityLabel={`Slot ${slot.slotId}, ${label}, ${slot.productID ?? 'unassigned'}`} accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={() => action && confirm(action, slot.slotId)} style={[styles.slot, slot.productID === null && styles.available, slot.productID === productID && styles.own]}>
          <Text>Slot {slot.slotId}</Text><Text>{label}</Text><Text>{slot.productID ?? 'Unassigned'}</Text>
        </Pressable>;
      })}</View>
      <Button title="Take off rack" disabled={!adapter?.writesEnabled || busy || snapshot.product.status !== 'OCCUPIED'} onPress={() => confirm('TakeOffRack')} />
      {snapshot.product.status === 'OCCUPIED' && <Text>Take the product off its rack before dispatching it.</Text>}
      <Button title="Remove Product (external dispatch)" disabled={!adapter?.writesEnabled || busy || snapshot.product.status !== 'PENDING_DISPATCH' || snapshot.product.expiry !== 'valid'} onPress={() => confirm('DispatchProduct')} />
    </>}
    <Button title="Refresh inventory" disabled={busy} onPress={() => void reload()} />
  </View>;
}

const styles = StyleSheet.create({
  panel: { width: '100%', marginTop: 20, gap: 8 }, heading: { fontSize: 18, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '25%', minHeight: 80, padding: 5, backgroundColor: '#dedede', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  available: { backgroundColor: '#b6e5bd' }, own: { borderColor: '#345ea8' },
});

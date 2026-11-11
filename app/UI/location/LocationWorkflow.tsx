import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { actionForSlot, canDispatch, makeCommand, slotLabels, slotState, SNAPSHOT_REFRESH_MS, validateSnapshot, type Action, type Command, type Snapshot } from './core';
import { locationAdapter, type LocationAdapter } from './adapter';
import { refreshCommand } from './service';

export function LocationWorkflow({ productID, adapter = locationAdapter, onBusyChange }: { productID: string; adapter?: LocationAdapter | null; onBusyChange?: (busy: boolean) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('Loading inventory…');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const active = useRef(true);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const generation = useRef(0);
  const request = useRef<AbortController | null>(null);
  const dismissConfirmation = useRef<(() => void) | null>(null);
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
    if (!adapter) { setMessage('Location operations unavailable: a connector adapter is not configured. No changes were made.'); return null; }
    if (!foreground.current) return null;
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const result = await adapter.read(productID, controller.signal);
      if (!active.current || current !== generation.current) return null;
      if (!result) { setSnapshot(null); setMessage(uncertain.current ?? 'Product not found. No changes were made.'); return null; }
      const value = validateSnapshot(result, productID);
      setSnapshot(value);
      setMessage(uncertain.current ?? (adapter.writesEnabled ? 'Assignments reserve slots only. The rack sensor controls placement, take-off, and return.' : 'Read-only: location writes are unavailable.'));
      return value;
    } catch (error) {
      if (active.current && current === generation.current) {
        setSnapshot(null);
        const detail = error instanceof Error ? error.message : 'Could not load inventory. Refresh to check state.';
        setMessage(uncertain.current ? `${uncertain.current} Inventory refresh failed: ${detail}` : detail);
      }
      return null;
    } finally { if (request.current === controller) request.current = null; }
  }, [adapter, productID]);

  const reload = useCallback(async () => {
    if (lock.current || !foreground.current) return;
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
    const poll = setInterval(() => { void reload(); }, SNAPSHOT_REFRESH_MS);

    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (state === 'active') void reload();
      else {
        counter.current++;
        request.current?.abort();
        request.current = null;
        dismissConfirmation.current?.();
        setSnapshot(null);
      }
    });
    return () => {
      mounted = false;
      active.current = false;
      counter.current++;
      clearInterval(poll);

      subscription.remove();
      request.current?.abort();
      dismissConfirmation.current?.();
      onBusyChange?.(false);
    };
  }, [reload, onBusyChange]);

  const preflight = useCallback(async (command: Command) => {
    if (!adapter || !foreground.current) throw new Error('Return to the app and refresh before confirming.');
    const current = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const latest = await refreshCommand(adapter, command, controller.signal);
      if (!active.current || !foreground.current || current !== generation.current) throw new Error('The screen changed. Refresh and confirm again.');
      setSnapshot(latest);
    } finally { if (request.current === controller) request.current = null; }
  }, [adapter]);

  // The tap lock spans database reads, confirmation, mutation, and the final refresh.
  const execute = useCallback(async (command: Command) => {
    let sent = false;
    try {
      if (!adapter?.writesEnabled) return;
      await preflight(command);
      uncertain.current = null;
      sent = true;
      const result = await adapter.submit(command);
      if (!active.current) return;
      const refreshed = await refresh();
      if (active.current && foreground.current) setMessage(refreshed ? result.message : `${result.message} Refresh inventory to check the current state.`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Check the connection.';
      if (sent) uncertain.current = `Outcome not confirmed. ${detail} Check current inventory and the physical product. The request may still complete; it was not automatically retried.`;
      if (active.current) {
        await refresh();
        if (foreground.current) setMessage(uncertain.current ?? `No command was sent. ${detail}`);
      }
    } finally { release(); }
  }, [adapter, preflight, refresh, release]);

  useEffect(() => {
    if (snapshot?.product.expiry === 'expired' && !busy && !lock.current && !expiredRecorded.current && adapter?.writesEnabled) {
      // One attempt per deliberate scan, including when its response is lost.
      expiredRecorded.current = true;
      lock.current = true;
      setWorking(true);
      void execute(makeCommand(snapshot, 'RecordExpiredScan'));
    }
  }, [snapshot, busy, adapter, execute, setWorking]);

  async function confirm(action: Action, targetId?: number) {
    if (!adapter?.writesEnabled || !snapshot || lock.current || !foreground.current) return;
    lock.current = true;
    setWorking(true);
    try {
      const command = makeCommand(snapshot, action, targetId);
      await preflight(command);
      let open = true;
      const cancel = () => {
        if (open) { open = false; dismissConfirmation.current = null; release(); }
      };
      dismissConfirmation.current = cancel;
      const description = action === 'DispatchProduct'
        ? 'Confirm this product has left the warehouse. This releases its reserved slot. Saved vacant occupancy may be old; check the physical product.'
        : `Assign ${productID} to slot ${targetId}? This saves the assignment only, not placement or receipt. Place the scanned product there; the sensor cannot verify its identity.`;
      Alert.alert('Staff confirmation', description, [
        { text: 'Cancel', style: 'cancel', onPress: cancel },
        { text: 'Confirm', onPress: () => {
          if (!open) return;
          open = false;
          dismissConfirmation.current = null;
          void execute(command);
        } },
      ], { cancelable: true, onDismiss: cancel });
    } catch (error) {
      await refresh();
      if (active.current && foreground.current) setMessage(`No command was sent. ${error instanceof Error ? error.message : 'Refresh and try again.'}`);
      release();
    }
  }

  const source = snapshot?.slots.find(slot => slot.productID === productID);
  const onRack = source?.isOccupied === true;

  return <View style={styles.panel}>
    <Text style={styles.heading}>Location workflow</Text>
    <Text>{message}</Text>
    {busy && <ActivityIndicator accessibilityLabel="Processing operation" />}
    {snapshot && <>
      <Text>Stock: {snapshot.product.status} · Expiry: {snapshot.product.expiry}</Text>
      {snapshot.product.expiry === 'expired' && <Text>Expired: receiving assignment and normal dispatch are blocked. Rejection logging does not clear stock or slots; disposal is not supported. Sensor returns still update stock.</Text>}
      {snapshot.product.expiry === 'unknown' && <Text>Verify expiry before assigning or dispatching. Sensor transitions do not depend on phone expiry.</Text>}
      {onRack ? <Text>Already in Slot {source.slotId} · On rack (last saved occupancy).</Text> : <>
        <Text>{source ? source.isOccupied === null ? 'Occupancy unknown' : 'Off rack' : 'Unassigned'} — choose a slot.</Text>
        <View style={styles.grid}>{[...snapshot.slots].sort((a, b) => a.slotId - b.slotId).map(slot => {
          const state = slotState(slot);
          const action = actionForSlot(snapshot, slot.slotId);
          const enabled = !!action && !!adapter?.writesEnabled && !busy;
          const label = slot.productID === productID ? 'Keep current slot (no change)' : slotLabels[state];
          return <Pressable key={slot.slotId} accessibilityRole="button" accessibilityLabel={`Slot ${slot.slotId}, ${label}, ${slot.productID ?? 'unassigned'}${slot.isOccupied === null ? ', occupancy unknown' : ''}`} accessibilityState={{ disabled: !enabled }} disabled={!enabled} onPress={() => action && void confirm(action, slot.slotId)} style={[styles.slot, state === 'available' && styles.available, slot.productID === productID && styles.own]}>
            <Text>Slot {slot.slotId}</Text><Text>{label}</Text><Text>{slot.productID ?? 'Unassigned'}</Text>
            {slot.isOccupied === null && <Text>Occupancy unknown</Text>}
          </Pressable>;
        })}</View>
        <Text>Saved occupancy may be old. Unknown occupancy is selectable for unassigned slots in this demo; it does not prove vacancy. Other products’ assignments remain reserved.</Text>
        {!canDispatch(snapshot) && <Text>Departure requires valid expiry and a matching slot assignment that is not detected as occupied. Unknown occupancy is allowed for this demo; confirm the product has actually left.</Text>}
        <Button title="Remove Product (external dispatch)" disabled={!adapter?.writesEnabled || busy || !canDispatch(snapshot)} onPress={() => void confirm('DispatchProduct')} />
      </>}
    </>}
    <Button title={snapshot ? 'Refresh inventory' : 'Retry inventory'} disabled={busy} onPress={() => void reload()} />
  </View>;
}

const styles = StyleSheet.create({
  panel: { width: '100%', marginTop: 20, gap: 8 }, heading: { fontSize: 18, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: '25%', minHeight: 80, padding: 5, backgroundColor: '#dedede', borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  available: { backgroundColor: '#b6e5bd' }, own: { borderColor: '#345ea8' },
});

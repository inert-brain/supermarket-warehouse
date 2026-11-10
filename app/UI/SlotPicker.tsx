import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Button, Pressable, StyleSheet, Text, View } from 'react-native';
import { loadSlots } from './slots';
import { slotGrid, type Slot } from './slot-picker-core';

type SlotLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; slots: Slot[] };

const labels: Record<Slot['state'], string> = {
  unknown: 'Unknown',
  available: 'Available',
  occupied: 'Occupied',
  reserved: 'Reserved',
  removal_pending: 'Removal pending',
};

export function SlotPicker({ productID }: { productID: string }) {
  const [load, setLoad] = useState<SlotLoad>({ status: 'loading' });
  const request = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoad({ status: 'loading' });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      if (request.current === controller) {
        request.current = null;
        setLoad({ status: 'error', message: 'Slot lookup timed out. Retry to refresh availability.' });
      }
    }, 15000);
    try {
      const slots = await loadSlots(controller.signal);
      if (request.current === controller && !controller.signal.aborted) {
        setLoad({ status: 'success', slots: slotGrid(slots) });
      }
    } catch {
      if (request.current === controller && !controller.signal.aborted && !timedOut) {
        setLoad({ status: 'error', message: 'Could not load slots. Retry to refresh availability.' });
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) void refresh(); });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
      else {
        request.current?.abort();
        request.current = null;
        setLoad({ status: 'loading' });
      }
    });
    return () => {
      mounted = false;
      subscription.remove();
      request.current?.abort();
      request.current = null;
    };
  }, [refresh]);

  const slots = load.status === 'success' ? load.slots : slotGrid(null);
  const alreadyBound = slots.some(slot => slot.productID === productID);
  const hasAvailable = slots.some(slot => slot.state === 'available');

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>Select a slot</Text>
      {load.status === 'loading' && <View accessibilityRole="progressbar"><ActivityIndicator /><Text>Checking slots…</Text></View>}
      {load.status === 'error' && <Text style={styles.notice}>{load.message}</Text>}
      <View style={styles.grid}>
        {slots.map(slot => {
          const selectable = load.status === 'success' && slot.state === 'available' && !alreadyBound;
          return (
            <View key={slot.slotId} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Slot ${slot.slotId}, ${labels[slot.state]}, ${load.status === 'success' ? slot.productID ?? 'Unassigned' : 'Assignment unknown'}`}
                accessibilityState={{ disabled: !selectable }}
                disabled={!selectable}
                onPress={() => Alert.alert('Slot selection only', `Slot ${slot.slotId} for product ${productID} was not reserved. Placement requires sensor integration and a secure workflow.`)}
                style={[styles.slot, selectable && styles.available]}
              >
                <Text style={styles.slotTitle}>Slot {slot.slotId}</Text>
                <Text style={styles.slotLabel}>{labels[slot.state]}</Text>
                <Text style={styles.slotLabel}>
                  {load.status === 'success' ? slot.productID ?? 'Unassigned' : 'Assignment unknown'}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: true }} disabled style={styles.remove}>
        <Text style={styles.removeText}>Remove Product</Text>
      </Pressable>
      <Text style={styles.notice}>Removal is unavailable until sensor and removal-session integration is in place.</Text>
      {load.status === 'success' && alreadyBound && <Text style={styles.notice}>This product is already assigned to a slot. Transfers are not supported.</Text>}
      {load.status === 'success' && !hasAvailable && <Text style={styles.notice}>No verified available slots are shown.</Text>}
      <Text style={styles.notice}>Slot selection is a preview only; no placement or reservation is recorded.</Text>
      {load.status === 'error' && <Button title="Retry slots" onPress={() => void refresh()} />}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: '100%', marginTop: 20 },
  heading: { fontWeight: '600', fontSize: 18, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '25%', padding: 3 },
  slot: { backgroundColor: '#dedede', borderRadius: 6, minHeight: 72, alignItems: 'center', justifyContent: 'center', padding: 4 },
  available: { backgroundColor: '#b6e5bd' },
  slotTitle: { fontWeight: '600', textAlign: 'center' },
  slotLabel: { fontSize: 12, textAlign: 'center' },
  remove: { backgroundColor: '#dedede', borderRadius: 6, padding: 14, marginTop: 8, alignItems: 'center', width: '100%' },
  removeText: { color: '#444', fontWeight: '600' },
  notice: { marginTop: 10 },
});

import { BrutalButton as Button } from './BrutalButton';
import { palette } from './theme';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { readContainer, saveContainerProduct, validateReceiving, type ReceivingResult } from './receiving';
import { LocationWorkflow } from './location/LocationWorkflow';


type LookupState =
  | { status: 'loading' }
  | { status: 'success'; result: ReceivingResult }
  | { status: 'error'; message: string };

export default function App() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState<string | null>(null);
  const scanned = useRef(false);
    const expiryWarned = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [productStep, setProductStep] = useState<'idle' | 'scanning' | 'saving' | 'error'>('idle');
  const [productError, setProductError] = useState('');

  useEffect(() => () => {
    request.current?.abort();
    request.current = null;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getPermission();
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  async function lookupBarcode(value: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLookup({ status: 'loading' });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    try {
      const result = await validateReceiving(value, controller.signal);
      if (request.current === controller && !controller.signal.aborted) {
        setLookup({ status: 'success', result });
        if (!result.product.description && result.decision !== 'EXPIRED') {
          scanned.current = false;
          setProductStep('scanning');
        } else setProductStep('idle');
                if (result.decision === 'EXPIRY_UNKNOWN' && !expiryWarned.current) {
                  expiryWarned.current = true;
                  Alert.alert('Expiry unknown', 'Expiry is missing or invalid. You can continue assigning, reassigning, or dispatching this product. Check the physical product’s expiry when available.');
                }
      }
    } catch (error) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setLookup({
          status: 'error',
          message: timedOut ? 'The product check timed out. Registration may have completed; retry to read the current record.' :
            error instanceof Error ? error.message : 'Validation failed. Please retry.',
        });
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  function handleScan({ data }: BarcodeScanningResult) {
    if (scanned.current) return;
    scanned.current = true;
    if (barcode !== null && productStep === 'scanning') {
      void scanProduct(barcode, data);
      return;
    }
    setBarcode(data);
    void lookupBarcode(data);
  }

  async function scanProduct(containerID: string, code: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setProductStep('saving');
    setProductError('');
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      await saveContainerProduct(containerID, code, controller.signal);
      const fresh = await readContainer(containerID, controller.signal);
      if (request.current === controller && !controller.signal.aborted) {
        if (fresh.product.description !== code) throw new Error('Saved product changed. Refresh the container before continuing.');
        setLookup({ status: 'success', result: fresh });
        setProductStep('idle');
      }
    } catch (error) {
      if (request.current === controller) {
        setProductError(controller.signal.aborted ? 'Product save may have completed. Refresh the container before trying again.' :
          error instanceof Error ? error.message : 'Product scan failed. Refresh and retry.');
        setProductStep('error');
      }
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  function startProductScan() {
    if (locationBusy || productStep === 'saving') return;
    setProductError('');
    scanned.current = false;
    setProductStep('scanning');
  }

  function scanAgain() {
    if (locationBusy || productStep === 'saving') return;
    request.current?.abort();
    request.current = null;
    scanned.current = false;
    expiryWarned.current = false;
    setLookup(null);
    setProductStep('idle');
    setProductError('');
    setBarcode(null);
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Camera access needed</Text>
        <Text style={styles.message}>
          {permission.canAskAgain
            ? 'Allow camera access to scan a barcode.'
            : 'Enable camera access in Android settings, then return to the app.'}
        </Text>
        {permission.canAskAgain ? (
          <Button title="Allow camera access" onPress={() => void requestPermission()} />
        ) : (
          <Button title="Open settings" onPress={() => void Linking.openSettings()} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Text style={styles.kicker}>INVENTORY CONTROL / 08 SLOTS</Text>
      <Text accessibilityRole="header" style={styles.title}>THE RACK.</Text>
      <Text style={styles.section}>{productStep === 'scanning' ? '02 / SCAN THE PRODUCT' : '01 / SCAN A CONTAINER'}</Text>
      <Text style={styles.message}>Scan a retail barcode: Code 128, EAN-13, EAN-8, UPC-A, UPC-E or Code 39.</Text>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['code128', 'ean13', 'ean8', 'upc_a', 'upc_e', 'code39'] }}
        onBarcodeScanned={barcode === null || productStep === 'scanning' ? handleScan : undefined}
      />
      <ScrollView style={styles.result} contentContainerStyle={styles.resultContent}>
        {barcode === null ? (
          <Text>Waiting for a barcode…</Text>
        ) : (
          <>
            <Text style={styles.label}>CONTAINER / SCANNED VALUE</Text>
            <Text selectable style={styles.barcode}>{barcode}</Text>
            {lookup?.status === 'loading' && (
              <View accessibilityRole="progressbar">
                <ActivityIndicator />
                <Text>Checking product and registering if missing…</Text>
              </View>
            )}
            {lookup?.status === 'error' && (
              <>
                <Text style={styles.message}>{lookup.message}</Text>
                <Button title="Retry lookup" onPress={() => void lookupBarcode(barcode)} />
              </>
            )}
            {lookup?.status === 'success' && (
              <>
                {lookup.result.registered && (
                  <Text style={styles.message}>New product registered. Description and expiry are not provided; you can continue with an expiry warning.</Text>
                )}
                <Text style={styles.label}>Decision: {lookup.result.decision}</Text>
                <Text style={styles.message}>
                  {lookup.result.decision === 'READY_FOR_PUTAWAY'
                    ? 'Potentially eligible based on this device’s clock. Staff must verify before put-away; this does not record receipt.'
                    : lookup.result.decision === 'EXPIRED'
                      ? 'Expired: do not receive this product.'
                      : 'Expiry unknown: warning only. You can continue assigning, reassigning, or dispatching; check the physical product’s expiry when available.'}
                </Text>
                <Text>Container ID: {lookup.result.product.containerID}</Text>
                <Text>Description: {lookup.result.product.description ?? 'Not provided'}</Text>
                <Text>Expires on: {lookup.result.product.expiresOn ?? 'Unknown'}</Text>
                {productStep === 'scanning' && <>
                  <Text style={styles.label}>Scan the product for container {barcode}</Text>
                  {lookup.result.product.description && <Button title="Cancel product scan" onPress={() => { scanned.current = true; setProductStep('idle'); }} />}
                </>}
                {productStep === 'saving' && <View accessibilityRole="progressbar"><ActivityIndicator /><Text>Checking and saving product…</Text></View>}
                {productStep === 'error' && <><Text style={styles.message}>{productError}</Text><Button title="Refresh container" onPress={() => void lookupBarcode(barcode)} /></>}
                {productStep === 'idle' && <>
                  {lookup.result.decision !== 'EXPIRED' && <Button title="Change product" disabled={locationBusy} onPress={startProductScan} />}
                  <LocationWorkflow key={barcode} containerID={barcode} onBusyChange={setLocationBusy} />
                </>}
              </>
            )}
            <View style={styles.button}><Button title="Scan again" disabled={locationBusy || productStep === 'saving'} onPress={scanAgain} /></View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.paper, paddingTop: 48, paddingHorizontal: 18, paddingBottom: 28 },
  center: { flex: 1, backgroundColor: palette.paper, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  kicker: { color: palette.lime, backgroundColor: palette.ink, padding: 7, fontFamily: 'monospace', fontWeight: '700', fontSize: 10, alignSelf: 'flex-start' },
  title: { color: palette.ink, fontSize: 42, fontWeight: '900', letterSpacing: -2, marginTop: 8, marginBottom: 4 },
  section: { color: palette.ink, fontWeight: '900', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  message: { color: palette.ink, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  camera: { flex: 1, minHeight: 160, overflow: 'hidden', borderRadius: 3, borderWidth: 3, borderColor: palette.ink },
  result: { flexGrow: 0, maxHeight: '55%', marginTop: 12, borderWidth: 2, borderColor: palette.ink, backgroundColor: palette.panel },
  resultContent: { alignItems: 'stretch', padding: 14, gap: 8 },
  button: { marginTop: 12, marginBottom: 5 },
  label: { color: palette.ink, fontWeight: '900', fontSize: 12, letterSpacing: 0.4, backgroundColor: palette.lime, padding: 8 },
  barcode: { color: palette.ink, fontFamily: 'monospace', fontSize: 23, fontWeight: '700', marginVertical: 6 },
});

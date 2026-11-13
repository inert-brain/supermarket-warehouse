import { BrutalButton as Button } from './BrutalButton';
import { palette } from './theme';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { saveContainerProduct, validateReceiving, type ReceivingResult } from './receiving';
import { LocationWorkflow } from './location/LocationWorkflow';


type LookupState =
  | { status: 'loading' }
  | { status: 'success'; result: ReceivingResult }
  | { status: 'error'; message: string };

function hasProduct(result: ReceivingResult) {
  const description = result.product.description?.trim();
  return !!description && description !== result.product.containerID.trim();
}

export default function App() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState<string | null>(null);
  const scanned = useRef(false);
  // Native camera events can arrive from a previous render. Route using the
  // current phase, never the state captured by that old callback.
  const scanner = useRef<{ phase: 'container' | 'product' | 'paused'; containerID: string | null }>({ phase: 'container', containerID: null });
  const request = useRef<AbortController | null>(null);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [productStep, setProductStep] = useState<'idle' | 'ready' | 'scanning' | 'saving' | 'error'>('idle');
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
    scanner.current = { phase: 'paused', containerID: value };
    scanned.current = true;
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
        if (!hasProduct(result) && result.decision !== 'EXPIRED') {
          setProductStep('ready'); // Camera remains paused until staff are ready.
        } else setProductStep('idle');

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
    const current = scanner.current;
    if (scanned.current || current.phase === 'paused') return;
    // The container may still be in front of the lens after phase one.
    if (current.phase === 'product' && data.trim() === current.containerID?.trim()) return;
    scanned.current = true;
    scanner.current = { ...current, phase: 'paused' };
    if (current.phase === 'product' && current.containerID !== null) {
      void scanProduct(current.containerID, data);
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
      if (request.current === controller && !controller.signal.aborted) {
        setLookup(previous => previous?.status === 'success' && previous.result.product.containerID === containerID
          ? { status: 'success', result: { ...previous.result, product: { ...previous.result.product, description: code } } }
          : previous);
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
    scanner.current = { phase: 'paused', containerID: barcode };
    scanned.current = true;
    setProductStep('ready');
  }

  function armProductScanner() {
    scanner.current = { phase: 'product', containerID: barcode };
    scanned.current = false;
    setProductStep('scanning');
  }

  function scanAgain() {
    if (locationBusy || productStep === 'saving') return;
    request.current?.abort();
    request.current = null;
    scanner.current = { phase: 'container', containerID: null };
    scanned.current = false;
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
      <Text style={styles.section}>{barcode === null ? '01 / SCAN A CONTAINER' :
        lookup?.status === 'loading' ? '01 / CHECKING CONTAINER' :
        lookup?.status === 'error' ? '01 / CONTAINER CHECK FAILED' :
        productStep === 'saving' ? '02 / SAVING PRODUCT' :
        productStep === 'error' ? '02 / PRODUCT CHECK FAILED' :
        productStep === 'ready' ? '02 / PREPARE PRODUCT' :
        productStep === 'scanning' ? '02 / SCAN THE PRODUCT' :
        lookup?.status === 'success' && lookup.result.decision === 'EXPIRED' ? '03 / CONTAINER DETAILS' : '03 / CONTAINER READY'}</Text>
      <Text style={styles.message}>{productStep === 'ready' ? 'Move the container label away. Point the camera at the product, then tap Start product scan.' :
        productStep === 'scanning' ? `Container ${barcode} selected. Scan the product barcode.` :
        barcode === null ? 'Scan a container barcode to begin.' : 'Your selected container is shown below.'}</Text>
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
                <Text>Loading container…</Text>
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
                  <Text style={styles.message}>New container registered. Scan the product to fill it.</Text>
                )}
                <Text style={styles.label}>CONTAINER DETAILS</Text>
                <Text>Container ID: {lookup.result.product.containerID}</Text>
                <Text>Description: {lookup.result.product.description ?? 'Not provided'}</Text>
                {(productStep === 'ready' || productStep === 'scanning') && <>
                  <Text style={styles.label}>Scan the product for container {barcode}</Text>
                  {!!lookup.result.product.description?.trim() && !hasProduct(lookup.result) &&
                    <Text>The container barcode was saved as its contents. Scan the product to replace it.</Text>}
                  {productStep === 'ready' && <Button title="Start product scan" onPress={armProductScanner} />}
                  {hasProduct(lookup.result) && <Button title="Cancel product scan" onPress={() => { scanner.current.phase = 'paused'; scanned.current = true; setProductStep('idle'); }} />}
                </>}
                {productStep === 'saving' && <View accessibilityRole="progressbar"><ActivityIndicator /><Text>Saving product barcode…</Text></View>}
                {productStep === 'error' && <><Text style={styles.message}>{productError}</Text><Button title="Refresh container" onPress={() => void lookupBarcode(barcode)} /></>}
                {productStep === 'idle' && <>
                  {lookup.result.decision !== 'EXPIRED' && <Button title="Scan product" disabled={locationBusy} onPress={startProductScan} />}
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

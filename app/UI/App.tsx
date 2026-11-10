import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Button, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { validateReceiving, type ValidationResult } from './receiving';
import { LocationWorkflow } from './location/LocationWorkflow';


type LookupState =
  | { status: 'loading' }
  | { status: 'success'; result: ValidationResult }
  | { status: 'error'; message: string };

export default function App() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState<string | null>(null);
  const scanned = useRef(false);
  const request = useRef<AbortController | null>(null);
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);

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
      }
    } catch (error) {
      if (request.current === controller && (!controller.signal.aborted || timedOut)) {
        setLookup({
          status: 'error',
          message: timedOut ? 'The lookup timed out. Check the connection and retry.' :
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
    setBarcode(data);
    void lookupBarcode(data);
  }

  function scanAgain() {
    if (locationBusy) return;
    request.current?.abort();
    request.current = null;
    scanned.current = false;
    setLookup(null);
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
      <StatusBar style="auto" />
      <Text style={styles.title}>Barcode scanner</Text>
      <Text style={styles.message}>Point the camera at a Code 128 barcode.</Text>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['code128'] }}
        onBarcodeScanned={barcode === null ? handleScan : undefined}
      />
      <ScrollView style={styles.result} contentContainerStyle={styles.resultContent}>
        {barcode === null ? (
          <Text>Waiting for a barcode…</Text>
        ) : (
          <>
            <Text style={styles.label}>Scanned value</Text>
            <Text selectable style={styles.barcode}>{barcode}</Text>
            {lookup?.status === 'loading' && (
              <View accessibilityRole="progressbar">
                <ActivityIndicator />
                <Text>Checking product…</Text>
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
                <Text style={styles.label}>Decision: {lookup.result.decision}</Text>
                <Text style={styles.message}>
                  {lookup.result.decision === 'READY_FOR_PUTAWAY'
                    ? 'Potentially eligible based on this device’s clock. Staff must verify before put-away; this does not record receipt.'
                    : lookup.result.decision === 'EXPIRED'
                      ? 'Expired: do not receive this product.'
                      : 'Expiry unknown: do not receive until staff verify it.'}
                </Text>
                <Text>Product ID: {lookup.result.product.productID}</Text>
                <Text>Description: {lookup.result.product.description ?? 'Not provided'}</Text>
                <Text>Expires on: {lookup.result.product.expiresOn ?? 'Unknown'}</Text>
              </>
            )}
            <LocationWorkflow key={barcode} productID={barcode} onBusyChange={setLocationBusy} />
            <View style={styles.button}><Button title="Scan again" disabled={locationBusy} onPress={scanAgain} /></View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
  },
  camera: {
    flex: 1,
    minHeight: 200,
    overflow: 'hidden',
    borderRadius: 12,
  },
  result: {
    flexGrow: 0,
    maxHeight: '50%',
  },
  resultContent: {
    alignItems: 'center',
    paddingTop: 20,
  },
  button: {
    marginTop: 12,
  },
  label: {
    fontWeight: '600',
  },
  barcode: {
    fontSize: 22,
    marginVertical: 10,
  },
});

import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { AppState, Button, Linking, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState<string | null>(null);
  const scanned = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void getPermission();
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  function handleScan({ data }: BarcodeScanningResult) {
    if (scanned.current) return;
    scanned.current = true;
    setBarcode(data);
  }

  function scanAgain() {
    scanned.current = false;
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
      <View style={styles.result}>
        {barcode === null ? (
          <Text>Waiting for a barcode…</Text>
        ) : (
          <>
            <Text style={styles.label}>Scanned value</Text>
            <Text selectable style={styles.barcode}>{barcode}</Text>
            <Button title="Scan again" onPress={scanAgain} />
          </>
        )}
      </View>
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
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  label: {
    fontWeight: '600',
  },
  barcode: {
    fontSize: 22,
    marginVertical: 10,
  },
});

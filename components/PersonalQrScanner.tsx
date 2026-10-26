// Admin tool: scan a Student's / Teacher's PERSONAL QR code (from their Profile).
// Kept separate from the normal Scan tab so that screen is not changed.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { parsePersonalQRPayload } from '@/lib/qr';
import { scanPersonalQr } from '@/lib/sessions';

type Props = {
  sessionId: string;
  onRecorded: () => void; // refresh the dashboard lists
};

export default function PersonalQrScanner({ sessionId, onRecorded }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const busy = useRef(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!permission) return <View style={styles.box} />;

  if (!permission.granted) {
    return (
      <View style={styles.box}>
        <Text style={styles.text}>Camera permission is needed to scan.</Text>
        <AppButton theme="primary" title="Allow Camera" icon="camera" onPress={requestPermission} />
      </View>
    );
  }

  const handleScan = async ({ data }: { data: string }) => {
    if (busy.current) return; // ignore repeated reads of the same QR
    busy.current = true;

    const parsed = parsePersonalQRPayload(data);
    if (!parsed.ok) {
      setResult({ ok: false, text: parsed.message });
    } else {
      const r = await scanPersonalQr(sessionId, parsed.token);
      setResult({ ok: r.ok, text: r.message });
      if (r.ok) onRecorded();
    }

    // Wait 2 seconds before the next scan so one QR is not read twice.
    setTimeout(() => {
      busy.current = false;
    }, 2000);
  };

  return (
    <View>
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleScan}
        />
      </View>
      <Text style={[styles.result, result && (result.ok ? styles.ok : styles.error)]}>
        {result ? result.text : 'Point the camera at a personal QR code.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 12 },
  text: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12, textAlign: 'center' },
  cameraWrap: { height: 280, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  result: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    color: COLORS.textSecondary,
  },
  ok: { color: COLORS.primaryDeep },
  error: { color: COLORS.danger },
});

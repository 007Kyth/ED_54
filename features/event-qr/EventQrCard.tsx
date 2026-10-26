// Admin-side card that DISPLAYS the backup event QR code.
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { COLORS } from '@/constants/colors';
import { SESSION_LABELS, type SessionType } from '@/lib/sessions';
import { buildEventQrPayload } from './eventQr';

type Props = {
  eventTitle: string;
  sessionId: string;
  sessionType: SessionType;
};

export default function EventQrCard({ eventTitle, sessionId, sessionType }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{eventTitle}</Text>
      <Text style={styles.session}>{SESSION_LABELS[sessionType]}</Text>
      <View style={styles.qrBox}>
        <QRCode value={buildEventQrPayload(sessionId)} size={220} />
      </View>
      <Text style={styles.hint}>
        Students and Teachers: open the Scan tab, scan this code, and you will be recorded under
        your own account. It stops working when the session closes.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.sketchLine,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, textAlign: 'center' },
  session: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 12 },
  qrBox: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 10, marginBottom: 12 },
  hint: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 17 },
});

// History tab pieces: a switch, and the person's own attendance records
// (from the event QR they scanned, or from an admin scanning their personal QR).
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, GLOW } from '@/constants/colors';
import { SESSION_LABELS, type MyAttendanceRow } from '@/lib/sessions';

export type HistoryTab = 'attendance' | 'other';

const STATUS_COLOR = {
  present: COLORS.success,
  late: COLORS.warning,
  absent: COLORS.danger,
} as const;

const HOW: Record<string, string> = {
  personal_qr: 'Scanned by an admin',
  event_qr: 'You scanned the event QR',
  auto_absent: 'No scan - marked absent automatically',
};

export function HistorySwitch({
  items,
  tab,
  onChange,
}: {
  items: { key: HistoryTab; label: string }[];
  tab: HistoryTab;
  onChange: (t: HistoryTab) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <View style={styles.switchRow}>
      {items.map((it) => {
        const active = it.key === tab;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            onHoverIn={() => setHover(it.key)}
            onHoverOut={() => setHover(null)}
            style={[
              styles.switchBtn,
              hover === it.key && !active && styles.switchHover,
              active && styles.switchActive,
            ]}
          >
            <Text style={[styles.switchText, active && styles.switchTextActive]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MyAttendanceList({ records }: { records: MyAttendanceRow[] }) {
  if (records.length === 0) {
    return (
      <Text style={styles.empty}>
        No attendance yet. It appears here when you scan an event QR, or when an admin scans your
        QR.
      </Text>
    );
  }
  return (
    <FlatList
      data={records}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ paddingBottom: 24 }}
      renderItem={({ item }) => {
        const color = STATUS_COLOR[item.status];
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.eventTitle || 'Event'}</Text>
                <Text style={styles.meta}>{SESSION_LABELS[item.sessionType]}</Text>
              </View>
              <Text style={[styles.status, { color, borderColor: color }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            {item.scannedAt ? (
              <Text style={styles.meta}>{new Date(item.scannedAt).toLocaleString()}</Text>
            ) : null}
            <Text style={styles.meta}>{HOW[item.method ?? ''] ?? ''}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', marginBottom: 14 },
  switchBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  switchHover: { borderColor: COLORS.primarySoft, boxShadow: GLOW },
  switchActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primarySoft, boxShadow: GLOW },
  switchText: { fontSize: 13, fontWeight: '700', color: COLORS.primarySoft },
  switchTextActive: { color: COLORS.textOnPrimary },
  empty: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  status: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

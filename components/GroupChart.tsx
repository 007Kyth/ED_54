// Simple bar graph: for each "kind" of person, how many are Present / Late / Absent.
// Students are grouped by the chosen field. All teachers are ONE group.
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import type { SessionRecord } from '@/lib/sessions';

type Counts = { present: number; late: number; absent: number };

export default function GroupChart({ records }: { records: SessionRecord[] }) {
  const groups: Record<string, Counts> = {};
  records.forEach((r) => {
    const name = r.role === 'teacher' ? 'Teachers' : r.groupLabel;
    groups[name] = groups[name] ?? { present: 0, late: 0, absent: 0 };
    groups[name][r.status] += 1;
  });

  const names = Object.keys(groups).sort();
  const biggest = Math.max(1, ...names.map((n) => groups[n].present + groups[n].late + groups[n].absent));

  if (names.length === 0) {
    return <Text style={styles.empty}>No data for the graph yet.</Text>;
  }

  return (
    <View style={styles.card}>
      {names.map((name) => {
        const g = groups[name];
        const total = g.present + g.late + g.absent;
        return (
          <View key={name} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.total}>
                {g.present} present · {g.late} late · {g.absent} absent
              </Text>
            </View>
            <View style={styles.track}>
              <View style={{ flex: total, flexDirection: 'row', maxWidth: `${(total / biggest) * 100}%` }}>
                {g.present > 0 && <View style={{ flex: g.present, backgroundColor: COLORS.success }} />}
                {g.late > 0 && <View style={{ flex: g.late, backgroundColor: COLORS.warning }} />}
                {g.absent > 0 && <View style={{ flex: g.absent, backgroundColor: COLORS.danger }} />}
              </View>
            </View>
          </View>
        );
      })}
      <View style={styles.legend}>
        <Legend color={COLORS.success} text="Present" />
        <Legend color={COLORS.warning} text="Late" />
        <Legend color={COLORS.danger} text="Absent" />
      </View>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  empty: { fontSize: 13, color: COLORS.textSecondary },
  row: { marginBottom: 12 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  total: { fontSize: 12, color: COLORS.textSecondary },
  track: { height: 16, borderRadius: 8, backgroundColor: COLORS.surface, overflow: 'hidden', flexDirection: 'row' },
  legend: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  legendText: { fontSize: 12, color: COLORS.textSecondary },
});

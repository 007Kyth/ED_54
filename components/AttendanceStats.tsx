// Admin attendance statistics with drill-down:
//   Students -> Level -> Grade (or Course) -> (Strand / Year) -> Section -> names
//   Teachers -> names
// Everyone with an account is listed. Nobody who did not tap = Absent.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, GLOW } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

type Status = 'present' | 'late' | 'absent';
type Row = {
  user_id: string;
  name: string;
  role: string;
  academic_level: string | null;
  grade_level: number | null;
  strand_code: string | null;
  course_code: string | null;
  year_level: number | null;
  section_name: string | null;
  status: Status;
  scanned_at: string | null;
  via_event_qr: boolean;
};
type Step = { key: string; label: string; sort: string };
type Node = { key: string; label: string; sort: string; people: Row[]; children: Map<string, Node> };

const STATUS_COLOR: Record<Status, string> = {
  present: COLORS.success,
  late: COLORS.warning,
  absent: COLORS.danger,
};
const ORDER: Record<Status, number> = { present: 0, late: 1, absent: 2 };
const pad = (n: number | null) => String(n ?? 999).padStart(3, '0');

function pathFor(r: Row): Step[] {
  if (r.role === 'teacher') return [{ key: 'teachers', label: 'Teachers', sort: '2' }];
  const students: Step = { key: 'students', label: 'Students', sort: '1' };
  const section: Step = {
    key: 's:' + (r.section_name ?? ''),
    label: r.section_name ?? 'No section',
    sort: r.section_name ?? 'zzz',
  };
  const grade: Step = { key: 'g:' + r.grade_level, label: `Grade ${r.grade_level ?? '?'}`, sort: pad(r.grade_level) };

  if (r.academic_level === 'junior_high')
    return [students, { key: 'junior', label: 'Junior High', sort: '1' }, grade, section];
  if (r.academic_level === 'senior_high')
    return [
      students,
      { key: 'senior', label: 'Senior High', sort: '2' },
      grade,
      { key: 'st:' + (r.strand_code ?? ''), label: r.strand_code ?? 'No strand', sort: r.strand_code ?? 'zzz' },
      section,
    ];
  if (r.academic_level === 'college')
    return [
      students,
      { key: 'college', label: 'College', sort: '3' },
      { key: 'c:' + (r.course_code ?? ''), label: r.course_code ?? 'No course', sort: r.course_code ?? 'zzz' },
      { key: 'y:' + r.year_level, label: `Year ${r.year_level ?? '?'}`, sort: pad(r.year_level) },
      section,
    ];
  return [students, { key: 'unset', label: 'Not set yet', sort: '9' }];
}

function buildTree(rows: Row[]): Node {
  const root: Node = { key: 'root', label: 'All', sort: '', people: [], children: new Map() };
  for (const r of rows) {
    let node = root;
    node.people.push(r);
    for (const step of pathFor(r)) {
      let child = node.children.get(step.key);
      if (!child) {
        child = { ...step, people: [], children: new Map() };
        node.children.set(step.key, child);
      }
      child.people.push(r);
      node = child;
    }
  }
  return root;
}

function count(people: Row[]) {
  const c = { present: 0, late: 0, absent: 0 };
  for (const p of people) c[p.status] += 1;
  return c;
}

function Bar({ people }: { people: Row[] }) {
  const c = count(people);
  return (
    <View style={styles.bar}>
      <View style={{ flex: c.present, backgroundColor: COLORS.success }} />
      <View style={{ flex: c.late, backgroundColor: COLORS.warning }} />
      <View style={{ flex: c.absent, backgroundColor: COLORS.danger }} />
    </View>
  );
}

function Counts({ people }: { people: Row[] }) {
  const c = count(people);
  return (
    <Text style={styles.counts}>
      <Text style={{ color: COLORS.success }}>Present {c.present}</Text>
      {'  '}
      <Text style={{ color: COLORS.warning }}>Late {c.late}</Text>
      {'  '}
      <Text style={{ color: COLORS.danger }}>Absent {c.absent}</Text>
    </Text>
  );
}

function time(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

export default function AttendanceStats({ sessionId, title }: { sessionId: string; title: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string[]>([]);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setPath([]);
    const load = async () => {
      const { data, error: err } = await supabase.rpc('session_roster', { p_session_id: sessionId });
      if (!alive) return;
      if (err) {
        setError('Could not load attendance. Run supabase/step5_attendance_roster.sql in Supabase first.');
        return;
      }
      setError(null);
      setRows((data as Row[]) ?? []);
    };
    load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sessionId]);

  const mainRows = rows.filter((r) => !r.via_event_qr);
  // Event-QR people: first to scan is at the top; people who did not scan come last (A to Z).
  const eventRows = rows
    .filter((r) => r.via_event_qr)
    .sort((a, b) => {
      if (a.scanned_at && b.scanned_at)
        return new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime();
      if (a.scanned_at) return -1;
      if (b.scanned_at) return 1;
      return a.name.localeCompare(b.name);
    });
  const root = buildTree(mainRows);

  // Walk down the chosen path (stop early if the data changed under us).
  const trail: Node[] = [root];
  for (const key of path) {
    const next = trail[trail.length - 1].children.get(key);
    if (!next) break;
    trail.push(next);
  }
  const node = trail[trail.length - 1];
  const isLeaf = node.children.size === 0 && trail.length > 1;
  const children = [...node.children.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  const people = [...node.people].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name)
  );

  return (
    <View>
      <Text style={styles.section}>{title}</Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.crumbRow}>
        {trail.length > 1 && (
          <Pressable style={styles.back} onPress={() => setPath(path.slice(0, trail.length - 2))}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.crumb}>{trail.map((n) => n.label).join('  ›  ')}</Text>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>
          {node.people.length} {node.people.length === 1 ? 'person' : 'people'}
        </Text>
        <Counts people={node.people} />
        <Bar people={node.people} />
      </View>

      {rows.length === 0 && !error && (
        <Text style={styles.empty}>No students or teachers have an account yet.</Text>
      )}

      {!isLeaf &&
        children.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setPath([...path.slice(0, trail.length - 1), c.key])}
            onHoverIn={() => setHover(c.key)}
            onHoverOut={() => setHover(null)}
            style={[styles.card, hover === c.key && styles.cardHover]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{c.label}</Text>
              <Text style={styles.cardMeta}>{c.people.length} ›</Text>
            </View>
            <Counts people={c.people} />
            <Bar people={c.people} />
          </Pressable>
        ))}

      {isLeaf &&
        people.map((p) => (
          <View key={p.user_id} style={styles.person}>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{p.name}</Text>
              {p.scanned_at ? <Text style={styles.cardMeta}>Scanned {time(p.scanned_at)}</Text> : null}
            </View>
            <Text style={[styles.status, { color: STATUS_COLOR[p.status], borderColor: STATUS_COLOR[p.status] }]}>
              {p.status.toUpperCase()}
            </Text>
          </View>
        ))}

      {eventRows.length > 0 && (
        <View>
          <Text style={styles.section}>Event QR scans</Text>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>
              {eventRows.length} {eventRows.length === 1 ? 'person' : 'people'}
            </Text>
            <Counts people={eventRows} />
            <Bar people={eventRows} />
          </View>
          {eventRows.map((p, i) => (
            <View key={p.user_id} style={styles.person}>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>
                  {i + 1}. {p.name}
                </Text>
                <Text style={styles.cardMeta}>
                  {p.role === 'teacher' ? 'Teacher' : 'Student'}
                  {p.scanned_at ? `  -  Scanned ${time(p.scanned_at)}` : ''}
                </Text>
              </View>
              <Text style={[styles.status, { color: STATUS_COLOR[p.status], borderColor: STATUS_COLOR[p.status] }]}>
                {p.status.toUpperCase()}
              </Text>
            </View>
          ))}
          <Text style={styles.hint}>
            People who checked in by scanning the event QR with their own phone. First to scan is on top.
          </Text>
        </View>
      )}

      <Text style={styles.hint}>
        Everyone with an account is listed. Anyone who did not tap is Absent. Names are sorted:
        Present first, then Late, then Absent, each A to Z.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 16, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: COLORS.primarySoft, marginTop: 18, marginBottom: 8 },
  crumbRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 },
  crumb: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, flexShrink: 1 },
  back: { borderWidth: 1, borderColor: COLORS.primarySoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginRight: 10 },
  backText: { color: COLORS.primarySoft, fontWeight: '700', fontSize: 13 },
  summary: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, marginBottom: 10 },
  summaryTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  counts: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: COLORS.surface },
  card: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  cardHover: { borderColor: COLORS.primarySoft, boxShadow: GLOW },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary },
  person: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 6 },
  personName: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  status: { fontSize: 11, fontWeight: '800', letterSpacing: 1, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  empty: { fontSize: 14, color: COLORS.textSecondary, marginVertical: 12 },
  error: { fontSize: 13, color: COLORS.danger, lineHeight: 18, marginBottom: 8 },
  hint: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18, marginTop: 10 },
});

// Lets a student choose their grade / strand / course / year / section.
// It uses YOUR existing tables: academic_strands, academic_courses, academic_sections.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { supabase } from '@/lib/supabase';

type Level = 'junior_high' | 'senior_high' | 'college';
type Strand = { id: string; code: string; name: string };
type Course = { id: string; code: string; name: string; year_levels: number };
type Section = {
  id: string;
  academic_level: string;
  grade_level: number | null;
  strand_id: string | null;
  course_id: string | null;
  year_level: number | null;
  name: string;
};

const LEVELS: { key: Level; label: string }[] = [
  { key: 'junior_high', label: 'Junior High' },
  { key: 'senior_high', label: 'Senior High' },
  { key: 'college', label: 'College' },
];

const same = (a: number | string | null | undefined, b: number | string | null | undefined) =>
  (a ?? null) === (b ?? null);

export default function AcademicPlacement({ userId }: { userId: string }) {
  const [strands, setStrands] = useState<Strand[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [level, setLevel] = useState<Level | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [strandId, setStrandId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    const [st, co, se, me] = await Promise.all([
      supabase.from('academic_strands').select('id, code, name').eq('is_active', true).order('sort_order'),
      supabase.from('academic_courses').select('id, code, name, year_levels').eq('is_active', true).order('sort_order'),
      supabase
        .from('academic_sections')
        .select('id, academic_level, grade_level, strand_id, course_id, year_level, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('profiles')
        .select('academic_level, grade_level, strand_id, course_id, year_level, section_id')
        .eq('id', userId)
        .maybeSingle(),
    ]);
    setStrands((st.data as Strand[]) ?? []);
    setCourses((co.data as Course[]) ?? []);
    setSections((se.data as Section[]) ?? []);
    const p: any = me.data;
    if (p) {
      setLevel(p.academic_level ?? null);
      setGrade(p.grade_level ?? null);
      setStrandId(p.strand_id ?? null);
      setCourseId(p.course_id ?? null);
      setYear(p.year_level ?? null);
      setSectionId(p.section_id ?? null);
      setLocked(!!p.section_id);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const pickLevel = (l: Level) => {
    setLevel(l);
    setGrade(null);
    setStrandId(null);
    setCourseId(null);
    setYear(null);
    setSectionId(null);
  };

  const course = courses.find((c) => c.id === courseId) ?? null;
  const gradeChoices = level === 'junior_high' ? [7, 8, 9, 10] : [11, 12];
  const yearChoices = Array.from({ length: course?.year_levels ?? 4 }, (_, i) => i + 1);

  const sectionChoices = sections.filter(
    (s) =>
      s.academic_level === level &&
      same(s.grade_level, level === 'college' ? null : grade) &&
      same(s.strand_id, level === 'senior_high' ? strandId : null) &&
      same(s.course_id, level === 'college' ? courseId : null) &&
      same(s.year_level, level === 'college' ? year : null)
  );

  const handleSave = async () => {
    if (!level) return setMessage('Choose Junior High, Senior High or College first.');
    if (level !== 'college' && !grade) return setMessage('Choose your grade.');
    if (level === 'senior_high' && !strandId) return setMessage('Choose your strand.');
    if (level === 'college' && (!courseId || !year)) return setMessage('Choose your course and year.');

    const { error } = await supabase
      .from('profiles')
      .update({
        academic_level: level,
        grade_level: level === 'college' ? null : grade,
        strand_id: level === 'senior_high' ? strandId : null,
        course_id: level === 'college' ? courseId : null,
        year_level: level === 'college' ? year : null,
        section_id: sectionId,
      })
      .eq('id', userId);
    setMessage(error ? error.message : 'Saved!');
    if (!error && sectionId) setLocked(true);
  };

  if (locked) {
    const strand = strands.find((s) => s.id === strandId);
    const sec = sections.find((s) => s.id === sectionId);
    const rows: [string, string][] = [
      ['Level', LEVELS.find((l) => l.key === level)?.label ?? '-'],
      level === 'college'
        ? ['Course', course?.code ?? '-']
        : ['Grade', grade ? `Grade ${grade}${strand ? ` - ${strand.code}` : ''}` : '-'],
    ];
    if (level === 'college') rows.push(['Year', year ? `Year ${year}` : '-']);
    rows.push(['Section', sec?.name ?? '-']);
    return (
      <View>
        {rows.map(([k, v]) => (
          <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text style={styles.label}>{k}</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.textPrimary }}>{v}</Text>
          </View>
        ))}
        <Text style={styles.empty}>Set at registration. Ask an admin if this needs to be corrected.</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>Level</Text>
      <Chips
        items={LEVELS.map((l) => ({ key: l.key, label: l.label }))}
        selected={level}
        onPick={(k) => pickLevel(k as Level)}
      />

      {(level === 'junior_high' || level === 'senior_high') && (
        <>
          <Text style={styles.label}>Grade</Text>
          <Chips
            items={gradeChoices.map((g) => ({ key: String(g), label: `Grade ${g}` }))}
            selected={grade ? String(grade) : null}
            onPick={(k) => {
              setGrade(Number(k));
              setSectionId(null);
            }}
          />
        </>
      )}

      {level === 'senior_high' && (
        <>
          <Text style={styles.label}>Strand</Text>
          <Chips
            items={strands.map((s) => ({ key: s.id, label: s.code }))}
            selected={strandId}
            onPick={(k) => {
              setStrandId(k);
              setSectionId(null);
            }}
          />
        </>
      )}

      {level === 'college' && (
        <>
          <Text style={styles.label}>Course</Text>
          <Chips
            items={courses.map((c) => ({ key: c.id, label: c.code }))}
            selected={courseId}
            onPick={(k) => {
              setCourseId(k);
              setYear(null);
              setSectionId(null);
            }}
          />
          <Text style={styles.label}>Year</Text>
          <Chips
            items={yearChoices.map((y) => ({ key: String(y), label: `Year ${y}` }))}
            selected={year ? String(year) : null}
            onPick={(k) => {
              setYear(Number(k));
              setSectionId(null);
            }}
          />
        </>
      )}

      {level && sectionChoices.length > 0 && (
        <>
          <Text style={styles.label}>Section (optional)</Text>
          <Chips
            items={sectionChoices.map((s) => ({ key: s.id, label: s.name }))}
            selected={sectionId}
            onPick={(k) => setSectionId(k === sectionId ? null : k)}
          />
        </>
      )}

      <View style={{ height: 12 }} />
      <AppButton title="Save" icon="save-outline" onPress={handleSave} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

function Chips({
  items,
  selected,
  onPick,
}: {
  items: { key: string; label: string }[];
  selected: string | null;
  onPick: (key: string) => void;
}) {
  if (items.length === 0) return <Text style={styles.empty}>Nothing to choose yet.</Text>;
  return (
    <View style={styles.row}>
      {items.map((i) => (
        <Pressable
          key={i.key}
          style={[styles.chip, i.key === selected && styles.chipActive]}
          onPress={() => onPick(i.key)}
        >
          <Text style={[styles.chipText, i.key === selected && styles.chipTextActive]}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginTop: 10, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDeep },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  chipTextActive: { color: COLORS.textOnPrimary },
  empty: { fontSize: 13, color: COLORS.textSecondary },
  message: { fontSize: 13, color: COLORS.primary, textAlign: 'center', marginTop: 4 },
});

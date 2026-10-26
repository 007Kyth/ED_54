// Level / grade / strand / course / year / section picker for the Register screen.
// It only chooses a section. The database saves it when the account is created.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COLORS, GLOW } from '@/constants/colors';
import type { Placement } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export type { Placement };

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

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

type Props = {
  sectionId: string | null;
  onChange: (placement: Placement | null) => void;
  disabled?: boolean;
};

function Chips({
  items,
  selected,
  onPick,
  disabled,
}: {
  items: { key: string; label: string }[];
  selected: string | null;
  onPick: (key: string) => void;
  disabled?: boolean;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  return (
    <View style={styles.row}>
      {items.map((it) => {
        const active = it.key === selected;
        const hot = hoverKey === it.key;
        return (
          <Pressable
            key={it.key}
            disabled={disabled}
            onPress={() => onPick(it.key)}
            onHoverIn={() => setHoverKey(it.key)}
            onHoverOut={() => setHoverKey(null)}
            style={[styles.chip, hot && !active && styles.chipHover, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RegisterPlacement({ sectionId, onChange, disabled }: Props) {
  const [strands, setStrands] = useState<Strand[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [strandId, setStrandId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [st, co, se] = await Promise.all([
        supabase.from('academic_strands').select('id, code, name').eq('is_active', true).order('sort_order'),
        supabase.from('academic_courses').select('id, code, name, year_levels').eq('is_active', true).order('sort_order'),
        supabase
          .from('academic_sections')
          .select('id, academic_level, grade_level, strand_id, course_id, year_level, name')
          .eq('is_active', true)
          .order('name'),
      ]);
      setStrands((st.data as Strand[]) ?? []);
      setCourses((co.data as Course[]) ?? []);
      setSections((se.data as Section[]) ?? []);
      setLoaded(true);
    })();
  }, []);

  const clear = () => onChange(null);
  const course = courses.find((c) => c.id === courseId) ?? null;
  const gradeChoices = level === 'junior_high' ? [7, 8, 9, 10] : [11, 12];
  const years = Array.from({ length: course?.year_levels ?? 0 }, (_, i) => i + 1);

  // Show the section row only when everything above it is chosen.
  const ready =
    level === 'junior_high' ? !!grade
    : level === 'senior_high' ? !!grade && !!strandId
    : level === 'college' ? !!courseId && !!year
    : false;

  const sectionChoices = !ready
    ? []
    : sections.filter(
        (s) =>
          s.academic_level === level &&
          same(s.grade_level, level === 'college' ? null : grade) &&
          same(s.strand_id, level === 'senior_high' ? strandId : null) &&
          same(s.course_id, level === 'college' ? courseId : null) &&
          same(s.year_level, level === 'college' ? year : null)
      );

  return (
    <View>
      <Text style={styles.note}>
        Choose your level, grade or course, and section. You pick these once now and cannot change
        them later.
      </Text>

      <Text style={styles.label}>Level</Text>
      <Chips
        disabled={disabled}
        items={LEVELS.map((l) => ({ key: l.key, label: l.label }))}
        selected={level}
        onPick={(k) => {
          setLevel(k as Level);
          setGrade(null);
          setStrandId(null);
          setCourseId(null);
          setYear(null);
          clear();
        }}
      />

      {(level === 'junior_high' || level === 'senior_high') && (
        <>
          <Text style={styles.label}>Grade</Text>
          <Chips
            disabled={disabled}
            items={gradeChoices.map((g) => ({ key: String(g), label: `Grade ${g}` }))}
            selected={grade ? String(grade) : null}
            onPick={(k) => {
              setGrade(Number(k));
              clear();
            }}
          />
        </>
      )}

      {level === 'senior_high' && grade && (
        <>
          <Text style={styles.label}>Strand</Text>
          {loaded && strands.length === 0 ? (
            <Text style={styles.empty}>No strands yet. Please ask your admin.</Text>
          ) : (
            <Chips
              disabled={disabled}
              items={strands.map((s) => ({ key: s.id, label: s.code }))}
              selected={strandId}
              onPick={(k) => {
                setStrandId(k);
                clear();
              }}
            />
          )}
        </>
      )}

      {level === 'college' && (
        <>
          <Text style={styles.label}>Course</Text>
          {loaded && courses.length === 0 ? (
            <Text style={styles.empty}>Courses could not be loaded. Please ask your admin.</Text>
          ) : (
            <Chips
              disabled={disabled}
              items={courses.map((c) => ({ key: c.id, label: c.code }))}
              selected={courseId}
              onPick={(k) => {
                setCourseId(k);
                setYear(null);
                clear();
              }}
            />
          )}
          {course && (
            <>
              <Text style={styles.label}>Year</Text>
              <Chips
                disabled={disabled}
                items={years.map((y) => ({ key: String(y), label: `Year ${y}` }))}
                selected={year ? String(year) : null}
                onPick={(k) => {
                  setYear(Number(k));
                  clear();
                }}
              />
            </>
          )}
        </>
      )}

      {ready && (
        <>
          <Text style={styles.label}>Section</Text>
          {sectionChoices.length === 0 ? (
            <Text style={styles.empty}>No sections yet for this choice. Please ask your admin.</Text>
          ) : (
            <Chips
              disabled={disabled}
              items={sectionChoices.map((s) => ({ key: s.id, label: s.name }))}
              selected={sectionId}
              onPick={(k) =>
                onChange({
                  section_id: k,
                  academic_level: level as Level,
                  grade_level: level === 'college' ? null : grade,
                  strand_id: level === 'senior_high' ? strandId : null,
                  course_id: level === 'college' ? courseId : null,
                  year_level: level === 'college' ? year : null,
                })
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: COLORS.textSecondary, marginTop: 10, lineHeight: 17 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginTop: 12, marginBottom: 6 },
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
  chipHover: { borderColor: COLORS.primarySoft, backgroundColor: COLORS.surfaceSoft, boxShadow: GLOW },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primarySoft, boxShadow: GLOW },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.primarySoft },
  chipTextActive: { color: COLORS.textOnPrimary },
  empty: { fontSize: 13, color: COLORS.textSecondary },
});

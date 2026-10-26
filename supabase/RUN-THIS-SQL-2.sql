-- RUN THIS ONE FILE ONCE in the Supabase SQL Editor (safe to run again).
-- Adds Junior High and Senior High sections (A to E for every grade / strand).

-- 1. Strands: only added if your strands table is completely empty.
insert into public.academic_strands (code, name, is_active, sort_order)
select v.code, v.name, true, v.ord
from (values
  ('STEM',  'Science, Technology, Engineering and Mathematics', 1),
  ('ABM',   'Accountancy, Business and Management',             2),
  ('HUMSS', 'Humanities and Social Sciences',                   3),
  ('GAS',   'General Academic Strand',                          4)
) as v(code, name, ord)
where not exists (select 1 from public.academic_strands);

-- 2. Junior High: Grade 7 to 10, sections A to E
insert into public.academic_sections (academic_level, grade_level, name, is_active)
select 'junior_high', g, l, true
from generate_series(7, 10) as g
cross join unnest(array['A','B','C','D','E']) as l
where not exists (
  select 1 from public.academic_sections s
  where s.academic_level = 'junior_high' and s.grade_level = g
    and s.strand_id is null and s.name = l
);

-- 3. Senior High: Grade 11 and 12, every strand, sections A to E
insert into public.academic_sections (academic_level, grade_level, strand_id, name, is_active)
select 'senior_high', g, st.id, l, true
from public.academic_strands st
cross join generate_series(11, 12) as g
cross join unnest(array['A','B','C','D','E']) as l
where st.is_active
  and not exists (
    select 1 from public.academic_sections s
    where s.academic_level = 'senior_high' and s.grade_level = g
      and s.strand_id = st.id and s.name = l
  );

-- Check: how many sections per level
select academic_level, count(*) as sections from public.academic_sections group by 1 order by 1;

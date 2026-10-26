-- STEP 3: course / year / section chosen at registration, then locked.
-- NOTE: your existing handle_new_user() already saves placement. Do not replace it.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- 1. The register screen runs before login, so courses and sections must be readable by "anon".
grant select on public.academic_courses  to anon;
grant select on public.academic_sections to anon;
drop policy if exists "Public read courses"  on public.academic_courses;
drop policy if exists "Public read sections" on public.academic_sections;
create policy "Public read courses"  on public.academic_courses  for select to anon, authenticated using (true);
create policy "Public read sections" on public.academic_sections for select to anon, authenticated using (true);

-- 2. Lock: once a student has a section, only an admin can change it.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.qr_token := old.qr_token;
    if new.role is distinct from old.role
       and (new.role not in ('student','teacher') or old.role = 'admin') then
      new.role := old.role;
    end if;
    if old.section_id is not null then
      new.academic_level := old.academic_level;
      new.grade_level    := old.grade_level;
      new.strand_id      := old.strand_id;
      new.course_id      := old.course_id;
      new.year_level     := old.year_level;
      new.section_id     := old.section_id;
    end if;
  end if;
  return new;
end $$;

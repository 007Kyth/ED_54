-- RUN THIS ONE FILE ONCE in the Supabase SQL Editor (safe to run again).
-- Marks who checked in with the event QR, so they get their own list.

drop function if exists public.session_roster(uuid);
create function public.session_roster(p_session_id uuid)
returns table (
  user_id        uuid,
  name           text,
  role           text,
  academic_level text,
  grade_level    smallint,
  strand_code    text,
  course_code    text,
  year_level     smallint,
  section_name   text,
  status         text,
  scanned_at     timestamptz,
  via_event_qr   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_event uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  select s.event_id into v_event from public.event_sessions s where s.id = p_session_id;

  return query
  select p.id,
         coalesce(nullif(p.full_name, ''), p.email)::text,
         p.role::text,
         p.academic_level::text,
         p.grade_level::smallint,
         st.code::text,
         co.code::text,
         p.year_level::smallint,
         se.name::text,
         coalesce(sa.status, 'absent')::text,
         sa.scanned_at,
         exists (select 1 from public.session_attendance x
                 where x.event_id = v_event and x.user_id = p.id and x.method = 'event_qr')
  from public.profiles p
  left join public.session_attendance sa on sa.session_id = p_session_id and sa.user_id = p.id
  left join public.academic_strands  st on st.id = p.strand_id
  left join public.academic_courses  co on co.id = p.course_id
  left join public.academic_sections se on se.id = p.section_id
  where p.role in ('student', 'teacher')
    and (
      sa.user_id is not null
      or not exists (select 1 from public.event_audiences x where x.event_id = v_event)
      or exists (select 1 from public.event_audiences ea
                 where ea.event_id = v_event and public.audience_matches(ea, p))
    );
end;
$$;

revoke all on function public.session_roster(uuid) from public, anon;
grant execute on function public.session_roster(uuid) to authenticated;

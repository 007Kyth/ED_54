-- ============================================================
-- QR-ATT  —  4 attendance sessions (built on your EXISTING database)
-- Run this ONCE in: Supabase Dashboard > SQL Editor > New query
--
-- It does NOT change your existing tables, functions or policies
-- (profiles, events, attendance, is_admin, record_attendance, ...).
-- It only ADDS: 2 new tables + 6 new functions.
-- Safe to run again.
-- ============================================================

-- ------------------------------------------------------------
-- 1. EVENT SESSIONS  (4 per event)
-- ------------------------------------------------------------
create table if not exists public.event_sessions (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  session_type text not null check (session_type in
                 ('morning_in', 'noon_out', 'afternoon_in', 'afternoon_out')),
  status       text not null default 'not_started'
                 check (status in ('not_started', 'open', 'closed')),
  started_at   timestamptz,   -- the ACTUAL start time (set by the server)
  closed_at    timestamptz,
  unique (event_id, session_type)
);

-- Every NEW event automatically gets its 4 sessions.
create or replace function public.create_default_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_sessions (event_id, session_type)
  values (new.id, 'morning_in'), (new.id, 'noon_out'),
         (new.id, 'afternoon_in'), (new.id, 'afternoon_out')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_event_created on public.events;
create trigger on_event_created
  after insert on public.events
  for each row execute procedure public.create_default_sessions();

-- Give the events you ALREADY have their 4 sessions too.
insert into public.event_sessions (event_id, session_type)
select e.id, t.session_type
from public.events e
cross join (values ('morning_in'), ('noon_out'), ('afternoon_in'), ('afternoon_out'))
  as t(session_type)
on conflict do nothing;

-- ------------------------------------------------------------
-- 2. SESSION ATTENDANCE  (one row per person per session)
-- ------------------------------------------------------------
create table if not exists public.session_attendance (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.event_sessions (id) on delete cascade,
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  status      text not null check (status in ('present', 'late', 'absent')),
  scanned_at  timestamptz,
  method      text check (method in ('personal_qr', 'event_qr', 'auto_absent')),
  recorded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (session_id, user_id)          -- <- this blocks duplicate records
);

create index if not exists session_attendance_session_idx
  on public.session_attendance (session_id);

-- ------------------------------------------------------------
-- 3. SECURITY (RLS): the app can READ, but never write directly.
--    All writing goes through the functions in section 4.
-- ------------------------------------------------------------
alter table public.event_sessions enable row level security;
alter table public.session_attendance enable row level security;

drop policy if exists "Sessions are readable by signed-in users" on public.event_sessions;
create policy "Sessions are readable by signed-in users"
  on public.event_sessions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Users read own session attendance" on public.session_attendance;
create policy "Users read own session attendance"
  on public.session_attendance for select
  using (auth.uid() = user_id or public.is_admin());

-- ------------------------------------------------------------
-- 4. FUNCTIONS (the rules live here, on the server)
-- ------------------------------------------------------------

-- 4a. INTERNAL: record one person in one session. Not callable from the app.
create or replace function public._record_attendance(
  p_session_id uuid,
  p_user_id    uuid,
  p_method     text,
  p_recorder   uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s           public.event_sessions%rowtype;
  u           public.profiles%rowtype;
  v_status    text;
  v_in_type   text;
  v_in_status text;
  v_rows      int;
  v_name      text;
begin
  -- Lock the session row so "close" and "scan" cannot collide.
  select * into s from public.event_sessions where id = p_session_id for share;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Session not found.');
  end if;

  select * into u from public.profiles where id = p_user_id;
  if not found or u.role not in ('student', 'teacher') then
    return jsonb_build_object('ok', false, 'message', 'Only student or teacher accounts can record attendance.');
  end if;
  v_name := coalesce(nullif(u.full_name, ''), u.email);

  if s.status = 'not_started' then
    return jsonb_build_object('ok', false, 'message', 'This session has not started yet.');
  end if;
  if s.status = 'closed' then
    return jsonb_build_object('ok', false, 'message', 'This session is closed.');
  end if;

  if exists (select 1 from public.session_attendance
             where session_id = s.id and user_id = p_user_id) then
    return jsonb_build_object('ok', false, 'name', v_name,
                              'message', v_name || ' is already recorded for this session.');
  end if;

  if s.session_type in ('morning_in', 'afternoon_in') then
    -- IN: within 1 hour of the real start = Present, after that = Late.
    if now() - s.started_at > interval '1 hour' then
      v_status := 'late';
    else
      v_status := 'present';
    end if;
  else
    -- OUT: tapping out never removes a Late status from the matching IN.
    v_in_type := case s.session_type when 'noon_out' then 'morning_in' else 'afternoon_in' end;
    select sa.status into v_in_status
    from public.session_attendance sa
    join public.event_sessions es on es.id = sa.session_id
    where es.event_id = s.event_id and es.session_type = v_in_type and sa.user_id = p_user_id;

    v_status := case when v_in_status = 'late' then 'late' else 'present' end;
  end if;

  insert into public.session_attendance
    (session_id, event_id, user_id, status, scanned_at, method, recorded_by)
  values
    (s.id, s.event_id, p_user_id, v_status, now(), p_method, p_recorder)
  on conflict (session_id, user_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return jsonb_build_object('ok', false, 'name', v_name,
                              'message', v_name || ' is already recorded for this session.');
  end if;

  return jsonb_build_object(
    'ok', true, 'status', v_status, 'name', v_name,
    'message', v_name || ' recorded as ' ||
               case v_status when 'late' then 'LATE' else 'PRESENT' end || '.'
  );
end;
$$;

revoke all on function public._record_attendance(uuid, uuid, text, uuid) from public, anon, authenticated;

-- 4b. ADMIN: start a session
create or replace function public.start_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s       public.event_sessions%rowtype;
  prev    public.event_sessions%rowtype;
  v_order text[] := array['morning_in', 'noon_out', 'afternoon_in', 'afternoon_out'];
  v_idx   int;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Only admins can start sessions.');
  end if;

  select * into s from public.event_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Session not found.');
  end if;
  if s.status <> 'not_started' then
    return jsonb_build_object('ok', false, 'message', 'This session was already started.');
  end if;

  v_idx := array_position(v_order, s.session_type);
  if v_idx > 1 then
    select * into prev from public.event_sessions
    where event_id = s.event_id and session_type = v_order[v_idx - 1];

    if prev.status = 'not_started' then
      return jsonb_build_object('ok', false, 'message', 'Start the earlier session first.');
    end if;
    -- Afternoon IN can only start after Noon OUT is closed.
    if prev.session_type = 'noon_out' and prev.status <> 'closed' then
      return jsonb_build_object('ok', false, 'message', 'Close Noon OUT before starting Afternoon IN.');
    end if;
    -- Starting an OUT session ends the IN session before it.
    if prev.session_type in ('morning_in', 'afternoon_in') and prev.status = 'open' then
      update public.event_sessions
      set status = 'closed', closed_at = now()
      where id = prev.id;
    end if;
  end if;

  update public.event_sessions
  set status = 'open', started_at = now()
  where id = s.id;

  return jsonb_build_object('ok', true, 'message', 'Session started.');
end;
$$;

-- 4c. ADMIN: stop an IN session (nobody is marked Absent by this)
create or replace function public.stop_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_sessions%rowtype;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Only admins can stop sessions.');
  end if;

  select * into s from public.event_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Session not found.');
  end if;
  if s.session_type not in ('morning_in', 'afternoon_in') then
    return jsonb_build_object('ok', false, 'message', 'Use Close for OUT sessions.');
  end if;
  if s.status <> 'open' then
    return jsonb_build_object('ok', false, 'message', 'This session is not open.');
  end if;

  update public.event_sessions
  set status = 'closed', closed_at = now()
  where id = s.id;

  return jsonb_build_object('ok', true, 'message', 'Session stopped. Scanning is now off.');
end;
$$;

-- 4d. ADMIN: close an OUT session (everyone EXPECTED who did not tap out = Absent)
--     "Expected" follows your event_audiences table: if the event has an
--     attendee list, only those people; if not, all students and teachers.
create or replace function public.close_out_session(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s        public.event_sessions%rowtype;
  v_absent int;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Only admins can close sessions.');
  end if;

  select * into s from public.event_sessions where id = p_session_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'message', 'Session not found.');
  end if;
  if s.session_type not in ('noon_out', 'afternoon_out') then
    return jsonb_build_object('ok', false, 'message', 'Only OUT sessions can be closed.');
  end if;
  if s.status <> 'open' then
    return jsonb_build_object('ok', false, 'message', 'This session is not open.');
  end if;

  insert into public.session_attendance
    (session_id, event_id, user_id, status, scanned_at, method, recorded_by)
  select s.id, s.event_id, p.id, 'absent', null, 'auto_absent', auth.uid()
  from public.profiles p
  where p.role in ('student', 'teacher')
    and (
      not exists (select 1 from public.event_audiences x where x.event_id = s.event_id)
      or exists (select 1 from public.event_audiences ea
                 where ea.event_id = s.event_id and public.audience_matches(ea, p))
    )
  on conflict (session_id, user_id) do nothing;

  get diagnostics v_absent = row_count;

  update public.event_sessions
  set status = 'closed', closed_at = now()
  where id = s.id;

  return jsonb_build_object('ok', true,
    'message', 'Session closed. ' || v_absent || ' marked Absent.');
end;
$$;

-- 4e. ADMIN: scan someone's PERSONAL QR code (uses the profile's qr_token)
create or replace function public.scan_personal_qr(p_session_id uuid, p_qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'message', 'Only admins can scan personal QR codes.');
  end if;

  select id into v_user from public.profiles where qr_token = p_qr_token;
  if v_user is null then
    return jsonb_build_object('ok', false,
      'message', 'This QR code is not recognised. Ask the person to open their Profile and show it again.');
  end if;

  return public._record_attendance(p_session_id, v_user, 'personal_qr', auth.uid());
end;
$$;

-- 4f. ANY LOGGED-IN USER: scan the backup EVENT QR code with their own phone.
--     Who you are comes from your login — NOT from the QR code.
create or replace function public.scan_event_qr(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_self_scan boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'message', 'Please log in first.');
  end if;

  -- Respect your existing per-event "self scan" switch.
  select e.self_scan_enabled into v_self_scan
  from public.event_sessions s
  join public.events e on e.id = s.event_id
  where s.id = p_session_id;

  if v_self_scan is not null and not v_self_scan then
    return jsonb_build_object('ok', false,
      'message', 'This event only accepts check-in by an admin scanning your personal QR.');
  end if;

  return public._record_attendance(p_session_id, auth.uid(), 'event_qr', auth.uid());
end;
$$;

-- 4g. ADMIN: the list for the dashboard (names, status, and "kind of student")
create or replace function public.session_people(p_session_id uuid)
returns table (
  id          uuid,
  user_id     uuid,
  name        text,
  role        text,
  status      text,
  scanned_at  timestamptz,
  group_label text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only.' using errcode = '42501';
  end if;

  return query
  select sa.id, sa.user_id,
         coalesce(nullif(p.full_name, ''), p.email),
         p.role, sa.status, sa.scanned_at,
         public.group_label(p.role, p.academic_level, p.grade_level,
                            st.code, co.code, p.year_level)
  from public.session_attendance sa
  join public.profiles p on p.id = sa.user_id
  left join public.academic_strands st on st.id = p.strand_id
  left join public.academic_courses co on co.id = p.course_id
  where sa.session_id = p_session_id
  order by sa.scanned_at nulls last, 3;
end;
$$;

-- Only logged-in users may call the public functions.
revoke all on function public.start_session(uuid)          from public, anon;
revoke all on function public.stop_session(uuid)           from public, anon;
revoke all on function public.close_out_session(uuid)      from public, anon;
revoke all on function public.scan_personal_qr(uuid, text) from public, anon;
revoke all on function public.scan_event_qr(uuid)          from public, anon;
revoke all on function public.session_people(uuid)         from public, anon;
grant execute on function public.start_session(uuid)          to authenticated;
grant execute on function public.stop_session(uuid)           to authenticated;
grant execute on function public.close_out_session(uuid)      to authenticated;
grant execute on function public.scan_personal_qr(uuid, text) to authenticated;
grant execute on function public.scan_event_qr(uuid)          to authenticated;
grant execute on function public.session_people(uuid)         to authenticated;

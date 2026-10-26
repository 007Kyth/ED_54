-- STEP 4: admins can delete any event (even one a teacher created).
-- Run once in the Supabase SQL Editor. Safe to re-run.
drop policy if exists "Admins can delete any event" on public.events;
create policy "Admins can delete any event"
  on public.events for delete to authenticated
  using (public.is_admin());

alter table public.bug_reports
  add column deleted_at timestamptz;

create policy "Bug reports are soft deletable by administrators"
on public.bug_reports
for update
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant update on table public.bug_reports to authenticated;

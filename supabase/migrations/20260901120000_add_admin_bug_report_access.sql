create policy "Bug reports are readable by administrators"
on public.bug_reports
for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant select on table public.bug_reports to authenticated;

alter table public.bug_reports
  add column username text,
  add column floor_snapshot_id bigint references public.dungeon_run_snapshots (id)
    on delete set null;

create index bug_reports_floor_snapshot_id_idx
  on public.bug_reports (floor_snapshot_id);

update public.bug_reports as reports
set username = coalesce(
  public.extract_display_name(users.raw_user_meta_data),
  users.email,
  reports.user_id::text
)
from auth.users as users
where users.id = reports.user_id
  and reports.username is null;

create policy "Dungeon run snapshots are readable by administrators"
on public.dungeon_run_snapshots
for select
to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

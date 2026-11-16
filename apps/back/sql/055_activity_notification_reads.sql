create table if not exists public.activity_notification_reads (
  account_id uuid not null references public.accounts(id) on delete cascade,
  activity_id text not null references public.feed_activities(id) on delete cascade,
  read_at_ms bigint not null,
  primary key (account_id, activity_id)
);

create index if not exists activity_notification_reads_account_read_at_idx
  on public.activity_notification_reads (account_id, read_at_ms desc);

alter table public.activity_notification_reads enable row level security;
revoke all on table public.activity_notification_reads from public, anon, authenticated;

create or replace function public.nexus_get_activity_read_ids(
  p_user_id uuid,
  p_activity_ids text[]
)
returns table (activity_id text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'ACTIVITY_READ_USER_REQUIRED' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return;
  end if;

  return query
  select read_state.activity_id
  from public.activity_notification_reads read_state
  where read_state.account_id = p_user_id
    and read_state.activity_id = any(p_activity_ids);
end;
$function$;

create or replace function public.nexus_mark_activities_read(
  p_user_id uuid,
  p_activity_ids text[],
  p_read_at_ms bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer := 0;
begin
  if p_user_id is null or p_read_at_ms is null
     or coalesce(cardinality(p_activity_ids), 0) > 50 then
    raise exception 'ACTIVITY_READ_INPUT_INVALID' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return 0;
  end if;

  insert into public.activity_notification_reads (account_id, activity_id, read_at_ms)
  select p_user_id, activity.id, p_read_at_ms
  from public.feed_activities activity
  where activity.id = any(p_activity_ids)
    and exists (
      select 1
      from public.nexus_get_activity_feed_page(p_user_id, 50, null, null) visible
      where visible.id = activity.id
    )
  on conflict (account_id, activity_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.nexus_get_activity_read_ids(uuid, text[]) from public, authenticated;
revoke all on function public.nexus_mark_activities_read(uuid, text[], bigint) from public, authenticated;
grant execute on function public.nexus_get_activity_read_ids(uuid, text[]) to anon;
grant execute on function public.nexus_mark_activities_read(uuid, text[], bigint) to anon;

notify pgrst, 'reload schema';

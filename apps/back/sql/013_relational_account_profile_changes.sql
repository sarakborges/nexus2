create or replace function public.nexus_change_account_profile(
  p_account_id uuid,
  p_profile_id uuid,
  p_action text,
  p_make_current boolean default false,
  p_previous_current_profile_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_next_profile_id uuid;
  v_next_position integer;
  v_deleted_count integer;
begin
  if p_account_id is null or p_profile_id is null
     or p_action not in ('select', 'add', 'remove') then
    raise exception 'INVALID_ACCOUNT_PROFILE_CHANGE' using errcode = '22023';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_account_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_action = 'select' then
    if not exists (
      select 1
      from public.account_profiles membership
      where membership.account_id = p_account_id
        and membership.profile_id = p_profile_id
    ) then
      raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
    end if;

    update public.accounts
    set current_profile_id = p_profile_id
    where id = p_account_id;
    return;
  end if;

  if p_action = 'add' then
    if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(max(membership.position) + 1, 0)
    into v_next_position
    from public.account_profiles membership
    where membership.account_id = p_account_id;

    insert into public.account_profiles (account_id, profile_id, position)
    values (p_account_id, p_profile_id, v_next_position)
    on conflict (account_id, profile_id) do nothing;

    if p_make_current or v_current_profile_id is null then
      update public.accounts
      set current_profile_id = p_profile_id
      where id = p_account_id;
    end if;
    return;
  end if;

  delete from public.account_profiles
  where account_id = p_account_id
    and profile_id = p_profile_id;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count = 0 then
    return;
  end if;

  if v_current_profile_id = p_profile_id then
    if p_previous_current_profile_id is not null and exists (
      select 1
      from public.account_profiles membership
      where membership.account_id = p_account_id
        and membership.profile_id = p_previous_current_profile_id
    ) then
      v_next_profile_id := p_previous_current_profile_id;
    else
      select membership.profile_id
      into v_next_profile_id
      from public.account_profiles membership
      where membership.account_id = p_account_id
      order by membership.position asc
      limit 1;
    end if;

    update public.accounts
    set current_profile_id = v_next_profile_id
    where id = p_account_id;
  end if;
end;
$function$;

revoke all on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) from public, authenticated;
grant execute on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) to anon;

notify pgrst, 'reload schema';
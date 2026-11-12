create or replace function public.nexus_upsert_profile_relationship(
  p_user_id uuid,
  p_source_profile_id uuid,
  p_target_profile_id uuid,
  p_type text,
  p_updated_at_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_source_type text;
  v_target_type text;
  v_active_type text;
  v_pair_low uuid;
  v_pair_high uuid;
  v_current_type text;
  v_requested_by uuid;
  v_has_current boolean;
begin
  if p_user_id is null or p_source_profile_id is null or p_target_profile_id is null
     or p_source_profile_id = p_target_profile_id
     or p_updated_at_ms is null
     or p_type not in ('requested', 'connection', 'blocked') then
    raise exception 'INVALID_RELATIONSHIP_PARTICIPANTS' using errcode = '22023';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_source_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select profile.type into v_source_type
  from public.profiles profile
  where profile.id = p_source_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select profile.type into v_target_type
  from public.profiles profile
  where profile.id = p_target_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_source_type <> v_target_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  if v_current_profile_id is not null then
    select profile.type into v_active_type
    from public.profiles profile
    where profile.id = v_current_profile_id;

    if found and v_active_type <> v_source_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
  end if;

  v_pair_low := least(p_source_profile_id, p_target_profile_id);
  v_pair_high := greatest(p_source_profile_id, p_target_profile_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0::bigint)
  );

  select relationship.type, relationship.requested_by
  into v_current_type, v_requested_by
  from public.relationships relationship
  where relationship.profile_id = v_pair_low
    and relationship.related_profile_id = v_pair_high
  for update;

  v_has_current := found;

  if p_type = 'requested' and v_has_current then
    raise exception 'RELATIONSHIP_ALREADY_EXISTS' using errcode = '23505';
  end if;

  if p_type = 'connection' and (
    not v_has_current
    or v_current_type <> 'requested'
    or v_requested_by is not distinct from p_source_profile_id
  ) then
    raise exception 'ONLY_RECIPIENT_CAN_ACCEPT_REQUEST' using errcode = '42501';
  end if;

  insert into public.relationships (
    profile_id, related_profile_id, type, requested_by, blocked_by, updated_at_ms
  )
  values (
    v_pair_low,
    v_pair_high,
    p_type,
    case when p_type = 'requested' then p_source_profile_id else null end,
    case when p_type = 'blocked' then p_source_profile_id else null end,
    p_updated_at_ms
  )
  on conflict (profile_id, related_profile_id) do update
  set type = excluded.type,
      requested_by = excluded.requested_by,
      blocked_by = excluded.blocked_by,
      updated_at_ms = excluded.updated_at_ms;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id in (p_source_profile_id, p_target_profile_id);
end;
$function$;

create or replace function public.nexus_remove_profile_relationship(
  p_user_id uuid,
  p_source_profile_id uuid,
  p_target_profile_id uuid,
  p_updated_at_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_source_type text;
  v_target_type text;
  v_active_type text;
  v_pair_low uuid;
  v_pair_high uuid;
  v_current_type text;
  v_blocked_by uuid;
begin
  if p_user_id is null or p_source_profile_id is null or p_target_profile_id is null
     or p_source_profile_id = p_target_profile_id
     or p_updated_at_ms is null then
    raise exception 'INVALID_RELATIONSHIP_PARTICIPANTS' using errcode = '22023';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found or not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_source_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select profile.type into v_source_type
  from public.profiles profile
  where profile.id = p_source_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select profile.type into v_target_type
  from public.profiles profile
  where profile.id = p_target_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_source_type <> v_target_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  if v_current_profile_id is not null then
    select profile.type into v_active_type
    from public.profiles profile
    where profile.id = v_current_profile_id;

    if found and v_active_type <> v_source_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
  end if;

  v_pair_low := least(p_source_profile_id, p_target_profile_id);
  v_pair_high := greatest(p_source_profile_id, p_target_profile_id);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_pair_low::text || ':' || v_pair_high::text, 0::bigint)
  );

  select relationship.type, relationship.blocked_by
  into v_current_type, v_blocked_by
  from public.relationships relationship
  where relationship.profile_id = v_pair_low
    and relationship.related_profile_id = v_pair_high
  for update;

  if not found then
    return;
  end if;

  if v_current_type = 'blocked'
     and v_blocked_by is not null
     and v_blocked_by <> p_source_profile_id then
    raise exception 'ONLY_BLOCKER_CAN_UNBLOCK' using errcode = '42501';
  end if;

  delete from public.relationships
  where profile_id = v_pair_low
    and related_profile_id = v_pair_high;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id in (p_source_profile_id, p_target_profile_id);
end;
$function$;

revoke all on function public.nexus_upsert_profile_relationship(uuid, uuid, uuid, text, bigint) from public, authenticated;
revoke all on function public.nexus_remove_profile_relationship(uuid, uuid, uuid, bigint) from public, authenticated;
grant execute on function public.nexus_upsert_profile_relationship(uuid, uuid, uuid, text, bigint) to anon;
grant execute on function public.nexus_remove_profile_relationship(uuid, uuid, uuid, bigint) to anon;

notify pgrst, 'reload schema';
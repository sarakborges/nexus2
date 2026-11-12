-- Reconcile the live hardening of community membership writes with the
-- checked-in migration history. Serialize membership/ownership writes using
-- the same collection-version locks as the other targeted relational writes.

create or replace function public.nexus_change_community_relationship(
  p_user_id uuid,
  p_community_id uuid,
  p_target_profile_id uuid,
  p_actor_profile_id uuid,
  p_action text,
  p_updated_at_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_community_type text;
  v_owner_type text;
  v_actor_type text;
  v_target_type text;
  v_active_type text;
  v_actor_role text;
  v_target_role text;
  v_target_blocked_by uuid;
  v_target_exists boolean;
  v_self boolean;
  v_allowed boolean := false;
begin
  perform private.nexus_lock_collection_versions(array['communities', 'community_relationships', 'profiles']::text[]);

  if p_user_id is null
     or p_community_id is null
     or p_target_profile_id is null
     or p_actor_profile_id is null
     or p_updated_at_ms is null
     or p_action not in (
       'owner', 'moderator', 'connection', 'requested', 'blocked',
       'remove', 'demote', 'transfer'
     ) then
    raise exception 'COMMUNITY_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found or not exists (
    select 1
    from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_actor_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select profile.type
  into v_actor_type
  from public.profiles profile
  where profile.id = p_actor_profile_id
  for share;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select profile.type
  into v_target_type
  from public.profiles profile
  where profile.id = p_target_profile_id
  for share;

  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select community.type
  into v_community_type
  from public.communities community
  where community.id = p_community_id
  for update;

  if not found then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Community type is inherited from its owner profile, not selected from an
  -- independently editable community field.
  select owner_profile.type
  into v_owner_type
  from public.community_relationships owner_relationship
  join public.profiles owner_profile
    on owner_profile.id = owner_relationship.profile_id
  where owner_relationship.community_id = p_community_id
    and owner_relationship.type = 'owner'
  order by owner_relationship.updated_at_ms asc, owner_relationship.profile_id asc
  limit 1;

  if found then
    v_community_type := v_owner_type;
  end if;

  if v_actor_type <> v_community_type or v_target_type <> v_community_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  if v_current_profile_id is not null then
    select profile.type
    into v_active_type
    from public.profiles profile
    where profile.id = v_current_profile_id;

    if found and v_active_type <> v_actor_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
  end if;

  -- Serialize every membership/role change for this community. The row lock
  -- also protects the inherited owner type while the action is authorized.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_community_id::text, 0::bigint)
  );

  select relationship.type, relationship.blocked_by
  into v_actor_role, v_target_blocked_by
  from public.community_relationships relationship
  where relationship.profile_id = p_actor_profile_id
    and relationship.community_id = p_community_id;

  v_actor_role := coalesce(v_actor_role, null);

  select relationship.type, relationship.blocked_by
  into v_target_role, v_target_blocked_by
  from public.community_relationships relationship
  where relationship.profile_id = p_target_profile_id
    and relationship.community_id = p_community_id
  for update;

  v_target_exists := found;
  v_self := p_actor_profile_id = p_target_profile_id;

  if p_action = 'requested' then
    v_allowed := v_self and not v_target_exists;
  elsif p_action = 'connection' then
    v_allowed := v_actor_role in ('owner', 'moderator')
      and v_target_role = 'requested';
  elsif p_action = 'moderator' then
    v_allowed := v_actor_role = 'owner'
      and v_target_role = 'connection';
  elsif p_action = 'blocked' then
    v_allowed := not v_self
      and v_actor_role in ('owner', 'moderator')
      and v_target_role = 'connection';
  elsif p_action = 'remove' then
    if not v_target_exists then
      return;
    end if;

    v_allowed := (
      v_self and (
        v_target_role in ('connection', 'requested')
        or (
          v_target_role = 'blocked'
          and (v_target_blocked_by = p_actor_profile_id or v_target_blocked_by is null)
        )
      )
    ) or (
      v_actor_role in ('owner', 'moderator')
      and v_target_role in ('connection', 'requested', 'blocked')
      and not (v_actor_role = 'moderator' and v_target_role = 'moderator')
    );
  elsif p_action = 'demote' then
    v_allowed := v_actor_role = 'owner' and v_target_role = 'moderator';
    if not v_allowed then
      raise exception 'ONLY_OWNER_CAN_DEMOTE_MODERATOR' using errcode = '42501';
    end if;
  elsif p_action = 'transfer' then
    v_allowed := v_actor_role = 'owner' and v_target_role = 'moderator';
    if not v_allowed then
      raise exception 'OWNERSHIP_TRANSFER_NOT_ALLOWED' using errcode = '42501';
    end if;
  end if;

  if not v_allowed then
    raise exception 'COMMUNITY_ACTION_NOT_ALLOWED' using errcode = '42501';
  end if;

  if p_action in ('requested', 'connection', 'moderator', 'blocked') then
    insert into public.community_relationships (
      profile_id, community_id, type, requested_by, blocked_by, updated_at_ms
    )
    values (
      p_target_profile_id,
      p_community_id,
      p_action,
      case when p_action = 'requested' then p_actor_profile_id else null end,
      case when p_action = 'blocked' then p_actor_profile_id else null end,
      p_updated_at_ms
    )
    on conflict (profile_id, community_id) do update
    set type = excluded.type,
        requested_by = excluded.requested_by,
        blocked_by = excluded.blocked_by,
        updated_at_ms = excluded.updated_at_ms;
  elsif p_action = 'remove' then
    delete from public.community_relationships
    where profile_id = p_target_profile_id
      and community_id = p_community_id;
  elsif p_action = 'demote' then
    update public.community_relationships
    set type = 'connection',
        requested_by = null,
        blocked_by = null,
        updated_at_ms = p_updated_at_ms
    where profile_id = p_target_profile_id
      and community_id = p_community_id;
  elsif p_action = 'transfer' then
    update public.community_relationships
    set type = 'moderator',
        requested_by = null,
        blocked_by = null,
        updated_at_ms = p_updated_at_ms
    where profile_id = p_actor_profile_id
      and community_id = p_community_id;

    update public.community_relationships
    set type = 'owner',
        requested_by = null,
        blocked_by = null,
        updated_at_ms = p_updated_at_ms
    where profile_id = p_target_profile_id
      and community_id = p_community_id;
  end if;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id in (p_actor_profile_id, p_target_profile_id);

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(array['communities', 'community_relationships', 'profiles']::text[]);
end;
$function$;

revoke all on function public.nexus_change_community_relationship(uuid, uuid, uuid, uuid, text, bigint) from public, authenticated;
grant execute on function public.nexus_change_community_relationship(uuid, uuid, uuid, uuid, text, bigint) to anon;

notify pgrst, 'reload schema';
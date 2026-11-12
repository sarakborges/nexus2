-- Reapply version-aware direct writes from apps/back/sql/011_relational_profile_post_write.sql
create or replace function public.nexus_create_profile_post(
  p_user_id uuid,
  p_post_id uuid,
  p_profile_id uuid,
  p_content text,
  p_created_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  profile_id uuid,
  content text,
  created_at_ms bigint
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_expected_image_count integer;
  v_ready_image_count integer;
begin
  perform private.nexus_lock_collection_versions(array['media_files', 'profile_posts', 'profiles']::text[]);

  if p_user_id is null
     or p_post_id is null
     or p_profile_id is null
     or p_created_at_ms is null
     or p_content is null
     or char_length(p_content) > 8000 then
    raise exception 'INVALID_PROFILE_POST' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  v_expected_image_count := cardinality(coalesce(p_image_ids, array[]::uuid[]));
  if exists (
    select image_id
    from unnest(coalesce(p_image_ids, array[]::uuid[])) as image_id
    group by image_id
    having count(*) > 1
  ) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  -- Lock each candidate attachment before validating so concurrent posts cannot
  -- claim the same editor image in two transactions.
  perform file.id
  from public.media_files file
  where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
    and file.owner_user_id = p_user_id
    and file.purpose = 'editor-image'
    and file.status = 'ready'
    and (file.expires_at_ms is null or file.expires_at_ms > p_created_at_ms)
    and file.resource_type is null
    and file.resource_id is null
  for update;

  get diagnostics v_ready_image_count = row_count;
  if v_ready_image_count <> v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  insert into public.profile_posts (id, profile_id, content, created_at_ms)
  values (p_post_id, p_profile_id, p_content, p_created_at_ms);

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where public.profiles.id = p_profile_id;

  update public.media_files
  set resource_type = 'profile-post',
      resource_id = p_post_id
  where id = any(coalesce(p_image_ids, array[]::uuid[]));

  perform private.nexus_bump_collection_versions(array['media_files', 'profile_posts', 'profiles']::text[]);
  return query
  select post.id, post.profile_id, post.content, post.created_at_ms
  from public.profile_posts post
  where post.id = p_post_id;
end;
$function$;

revoke all on function public.nexus_create_profile_post(uuid, uuid, uuid, text, bigint, uuid[]) from public, authenticated;
grant execute on function public.nexus_create_profile_post(uuid, uuid, uuid, text, bigint, uuid[]) to anon;

notify pgrst, 'reload schema';

-- Reapply version-aware direct writes from apps/back/sql/012_relational_refresh_token_writes.sql
create or replace function public.nexus_issue_refresh_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at_ms bigint,
  p_now_ms bigint,
  p_previous_id uuid default null,
  p_previous_user_id uuid default null,
  p_previous_token_hash text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_locked_token_count integer;
begin
  perform private.nexus_lock_collection_versions(array['refresh_tokens']::text[]);

  if p_id is null
     or p_user_id is null
     or p_token_hash is null
     or p_token_hash = ''
     or p_expires_at_ms is null
     or p_now_ms is null then
    raise exception 'INVALID_REFRESH_TOKEN' using errcode = '22023';
  end if;

  if (
    p_previous_id is null
    and (p_previous_user_id is not null or p_previous_token_hash is not null)
  ) or (
    p_previous_id is not null
    and (p_previous_user_id is null or p_previous_token_hash is null)
  ) then
    raise exception 'INVALID_REFRESH_ROTATION' using errcode = '22023';
  end if;

  if p_previous_id is not null then
    perform token.id
    from public.refresh_tokens token
    where token.id = p_previous_id
      and token.user_id = p_previous_user_id
      and token.token_hash = p_previous_token_hash
      and token.expires_at_ms > p_now_ms
    for update;

    get diagnostics v_locked_token_count = row_count;
    if v_locked_token_count <> 1 then
      raise exception 'REFRESH_TOKEN_REVOKED' using errcode = '42501';
    end if;
  end if;

  delete from public.refresh_tokens
  where expires_at_ms <= p_now_ms;

  if p_previous_id is not null then
    delete from public.refresh_tokens
    where id = p_previous_id
      and user_id = p_previous_user_id
      and token_hash = p_previous_token_hash;
  end if;

  insert into public.refresh_tokens (id, user_id, token_hash, expires_at_ms)
  values (p_id, p_user_id, p_token_hash, p_expires_at_ms);
  perform private.nexus_bump_collection_versions(array['refresh_tokens']::text[]);

end;
$function$;

create or replace function public.nexus_revoke_refresh_token(p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform private.nexus_lock_collection_versions(array['refresh_tokens']::text[]);

  if p_token_hash is null or p_token_hash = '' then
    raise exception 'INVALID_REFRESH_TOKEN_HASH' using errcode = '22023';
  end if;

  delete from public.refresh_tokens
  where token_hash = p_token_hash;
  perform private.nexus_bump_collection_versions(array['refresh_tokens']::text[]);

end;
$function$;

revoke all on function public.nexus_issue_refresh_token(uuid, uuid, text, bigint, bigint, uuid, uuid, text) from public, authenticated;
revoke all on function public.nexus_revoke_refresh_token(text) from public, authenticated;
grant execute on function public.nexus_issue_refresh_token(uuid, uuid, text, bigint, bigint, uuid, uuid, text) to anon;
grant execute on function public.nexus_revoke_refresh_token(text) to anon;

notify pgrst, 'reload schema';

-- Reapply version-aware direct writes from apps/back/sql/013_relational_account_profile_changes.sql
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
  perform private.nexus_lock_collection_versions(array['accounts']::text[]);

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
    perform private.nexus_bump_collection_versions(array['accounts']::text[]);
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
    perform private.nexus_bump_collection_versions(array['accounts']::text[]);
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
  perform private.nexus_bump_collection_versions(array['accounts']::text[]);

end;
$function$;

revoke all on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) from public, authenticated;
grant execute on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) to anon;

notify pgrst, 'reload schema';

-- Reapply version-aware direct writes from apps/back/sql/014_relational_profile_relationship_writes.sql
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
  perform private.nexus_lock_collection_versions(array['profiles', 'relationships']::text[]);

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
  perform private.nexus_bump_collection_versions(array['profiles', 'relationships']::text[]);

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
  perform private.nexus_lock_collection_versions(array['profiles', 'relationships']::text[]);

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
  perform private.nexus_bump_collection_versions(array['profiles', 'relationships']::text[]);

end;
$function$;

revoke all on function public.nexus_upsert_profile_relationship(uuid, uuid, uuid, text, bigint) from public, authenticated;
revoke all on function public.nexus_remove_profile_relationship(uuid, uuid, uuid, bigint) from public, authenticated;
grant execute on function public.nexus_upsert_profile_relationship(uuid, uuid, uuid, text, bigint) to anon;
grant execute on function public.nexus_remove_profile_relationship(uuid, uuid, uuid, bigint) to anon;

notify pgrst, 'reload schema';

-- Reapply version-aware direct writes from apps/back/sql/015_relational_community_membership_writes.sql
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

-- Reapply version-aware direct writes from apps/back/sql/016_relational_profile_settings.sql
create or replace function public.nexus_get_profile_settings(
  p_user_id uuid,
  p_profile_id uuid
)
returns table (
  message_audience text,
  publish_activity_types text[],
  show_friend_activity_types text[]
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_has_settings boolean;
  v_message_audience text;
  v_publish_activity_types text[];
  v_show_friend_activity_types text[];
  v_default_activity_types text[] := array[
    'friend_connected', 'profile_post', 'community_created', 'community_membership'
  ]::text[];
begin
  if p_user_id is null or p_profile_id is null then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_profile_id;

  v_has_settings := found;

  if not v_has_settings then
    v_message_audience := 'everyone';
    v_publish_activity_types := v_default_activity_types;
    v_show_friend_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_publish_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.publish_activity = true
    );

    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_show_friend_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.show_friend_activity = true
    );
  end if;

  return query
  select
    coalesce(v_message_audience, 'everyone'),
    coalesce(v_publish_activity_types, array[]::text[]),
    coalesce(v_show_friend_activity_types, array[]::text[]);
end;
$function$;

create or replace function public.nexus_update_profile_settings(
  p_user_id uuid,
  p_profile_id uuid,
  p_patch jsonb
)
returns table (
  message_audience text,
  publish_activity_types text[],
  show_friend_activity_types text[]
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_has_settings boolean;
  v_message_audience text;
  v_publish_activity_types text[];
  v_show_friend_activity_types text[];
  v_default_activity_types text[] := array[
    'friend_connected', 'profile_post', 'community_created', 'community_membership'
  ]::text[];
begin
  perform private.nexus_lock_collection_versions(array['profile_settings']::text[]);

  if p_user_id is null or p_profile_id is null
     or p_patch is null
     or pg_catalog.jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'INVALID_PROFILE_SETTINGS_PATCH' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_id::text, 0::bigint)
  );

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_profile_id
  for update;

  v_has_settings := found;

  if p_patch ? 'messageAudience' then
    v_message_audience := case
      when p_patch ->> 'messageAudience' = 'friends' then 'friends'
      else 'everyone'
    end;
  elsif not v_has_settings then
    v_message_audience := 'everyone';
  else
    v_message_audience := coalesce(v_message_audience, 'everyone');
  end if;

  if p_patch ? 'publishActivityTypes' then
    if pg_catalog.jsonb_typeof(p_patch -> 'publishActivityTypes') = 'array' then
      select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
      into v_publish_activity_types
      from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
      where exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(p_patch -> 'publishActivityTypes') as requested(activity_type)
        where requested.activity_type = activity.activity_type
      );
    else
      v_publish_activity_types := v_default_activity_types;
    end if;
  elsif not v_has_settings then
    v_publish_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_publish_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.publish_activity = true
    );
  end if;

  if p_patch ? 'showFriendActivityTypes' then
    if pg_catalog.jsonb_typeof(p_patch -> 'showFriendActivityTypes') = 'array' then
      select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
      into v_show_friend_activity_types
      from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
      where exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(p_patch -> 'showFriendActivityTypes') as requested(activity_type)
        where requested.activity_type = activity.activity_type
      );
    else
      v_show_friend_activity_types := v_default_activity_types;
    end if;
  elsif not v_has_settings then
    v_show_friend_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_show_friend_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.show_friend_activity = true
    );
  end if;

  insert into public.profile_settings (profile_id, message_audience)
  values (p_profile_id, v_message_audience)
  on conflict (profile_id) do update
  set message_audience = excluded.message_audience;

  insert into public.profile_activity_preferences (
    profile_id, activity_type, publish_activity, show_friend_activity
  )
  select
    p_profile_id,
    activity.activity_type,
    activity.activity_type = any(v_publish_activity_types),
    activity.activity_type = any(v_show_friend_activity_types)
  from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
  on conflict (profile_id, activity_type) do update
  set publish_activity = excluded.publish_activity,
      show_friend_activity = excluded.show_friend_activity;

  return query
  select
    v_message_audience,
    v_publish_activity_types,
    v_show_friend_activity_types;
  perform private.nexus_bump_collection_versions(array['profile_settings']::text[]);

end;
$function$;

revoke all on function public.nexus_get_profile_settings(uuid, uuid) from public, authenticated;
revoke all on function public.nexus_update_profile_settings(uuid, uuid, jsonb) from public, authenticated;
grant execute on function public.nexus_get_profile_settings(uuid, uuid) to anon;
grant execute on function public.nexus_update_profile_settings(uuid, uuid, jsonb) to anon;

notify pgrst, 'reload schema';

-- Reapply version-aware direct writes from apps/back/sql/017_relational_profile_message_writes.sql
create or replace function public.nexus_send_profile_message(
  p_user_id uuid,
  p_message_id uuid,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_content text,
  p_created_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  from_profile_id uuid,
  to_profile_id uuid,
  content text,
  created_at_ms bigint,
  is_favorite boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_from_type text;
  v_to_type text;
  v_active_type text;
  v_message_audience text;
  v_expected_image_count integer;
  v_valid_image_count integer;
  v_pair_low uuid;
  v_pair_high uuid;
  v_plain_content text;
begin
  perform private.nexus_lock_collection_versions(array['media_files', 'profile_messages', 'profiles']::text[]);

  if p_user_id is null
     or p_message_id is null
     or p_from_profile_id is null
     or p_to_profile_id is null
     or p_from_profile_id = p_to_profile_id
     or p_content is null
     or p_created_at_ms is null
     or char_length(p_content) > 8000 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  v_plain_content := pg_catalog.btrim(
    pg_catalog.regexp_replace(p_content, '<[^>]*>', '', 'g')
  );

  if v_plain_content = ''
     and p_content !~* '<img\b'
     and cardinality(coalesce(p_image_ids, array[]::uuid[])) = 0 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_from_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select profile.type into v_from_type
  from public.profiles profile
  where profile.id = p_from_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select profile.type into v_to_type
  from public.profiles profile
  where profile.id = p_to_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_from_type <> v_to_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  if v_current_profile_id is not null then
    select profile.type into v_active_type
    from public.profiles profile
    where profile.id = v_current_profile_id;

    if found and v_active_type <> v_from_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
  end if;

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_to_profile_id;

  if found and v_message_audience = 'friends' then
    if not exists (
      select 1
      from public.account_profiles membership
      where membership.account_id = p_user_id
        and membership.profile_id = p_to_profile_id
    ) then
      v_pair_low := least(p_from_profile_id, p_to_profile_id);
      v_pair_high := greatest(p_from_profile_id, p_to_profile_id);

      if not exists (
        select 1 from public.relationships relationship
        where relationship.profile_id = v_pair_low
          and relationship.related_profile_id = v_pair_high
          and relationship.type = 'connection'
      ) then
        raise exception 'PROFILE_MESSAGE_FRIENDS_ONLY' using errcode = '42501';
      end if;
    end if;
  end if;

  v_expected_image_count := cardinality(coalesce(p_image_ids, array[]::uuid[]));
  if exists (
    select image_id
    from unnest(coalesce(p_image_ids, array[]::uuid[])) as image_id
    group by image_id
    having count(*) > 1
  ) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  perform file.id
  from public.media_files file
  where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
    and file.owner_user_id = p_user_id
    and file.purpose = 'editor-image'
    and file.status = 'ready'
    and (file.expires_at_ms is null or file.expires_at_ms > p_created_at_ms)
  for update;

  get diagnostics v_valid_image_count = row_count;
  if v_valid_image_count <> v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.media_files file
    where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
      and (file.resource_type is not null or file.resource_id is not null)
  ) then
    raise exception 'EDITOR_IMAGE_ALREADY_ATTACHED' using errcode = '22023';
  end if;

  insert into public.profile_messages (
    id, from_profile_id, to_profile_id, content, created_at_ms, is_favorite
  )
  values (
    p_message_id, p_from_profile_id, p_to_profile_id, p_content, p_created_at_ms, false
  );

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id in (p_from_profile_id, p_to_profile_id);

  update public.media_files
  set resource_type = 'profile-message',
      resource_id = p_message_id,
      message_from_profile_id = p_from_profile_id,
      message_to_profile_id = p_to_profile_id
  where id = any(coalesce(p_image_ids, array[]::uuid[]));

  perform private.nexus_bump_collection_versions(array['media_files', 'profile_messages', 'profiles']::text[]);
  return query
  select message.id, message.from_profile_id, message.to_profile_id,
    message.content, message.created_at_ms, message.is_favorite
  from public.profile_messages message
  where message.id = p_message_id;
end;
$function$;

create or replace function public.nexus_delete_profile_message(
  p_user_id uuid,
  p_recipient_profile_id uuid,
  p_message_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_from_profile_id uuid;
  v_to_profile_id uuid;
begin
  perform private.nexus_lock_collection_versions(array['media_files', 'profile_messages']::text[]);

  if p_user_id is null or p_recipient_profile_id is null
     or p_message_id is null or p_actor_profile_id is null then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select message.from_profile_id, message.to_profile_id
  into v_from_profile_id, v_to_profile_id
  from public.profile_messages message
  where message.id = p_message_id
    and message.to_profile_id = p_recipient_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_actor_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  if p_actor_profile_id <> v_from_profile_id
     and p_actor_profile_id <> v_to_profile_id then
    raise exception 'PROFILE_MESSAGE_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.media_files
  set resource_type = null,
      resource_id = null,
      message_from_profile_id = null,
      message_to_profile_id = null
  where owner_user_id = p_user_id
    and resource_type = 'profile-message'
    and resource_id = p_message_id;

  delete from public.profile_messages
  where id = p_message_id
    and to_profile_id = p_recipient_profile_id;
  perform private.nexus_bump_collection_versions(array['media_files', 'profile_messages']::text[]);

end;
$function$;

create or replace function public.nexus_set_profile_message_favorite(
  p_user_id uuid,
  p_recipient_profile_id uuid,
  p_message_id uuid,
  p_actor_profile_id uuid,
  p_is_favorite boolean
)
returns table (
  id uuid,
  from_profile_id uuid,
  to_profile_id uuid,
  content text,
  created_at_ms bigint,
  is_favorite boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform private.nexus_lock_collection_versions(array['profile_messages']::text[]);

  if p_user_id is null or p_recipient_profile_id is null
     or p_message_id is null or p_actor_profile_id is null
     or p_is_favorite is null then
    raise exception 'PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_profile_id <> p_recipient_profile_id
     or not exists (
       select 1 from public.account_profiles membership
       where membership.account_id = p_user_id
         and membership.profile_id = p_recipient_profile_id
     ) then
    raise exception 'PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED' using errcode = '42501';
  end if;

  return query
  update public.profile_messages message
  set is_favorite = p_is_favorite
  where message.id = p_message_id
    and message.to_profile_id = p_recipient_profile_id
  returning message.id, message.from_profile_id, message.to_profile_id,
    message.content, message.created_at_ms, message.is_favorite;

  if not found then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform private.nexus_bump_collection_versions(array['profile_messages']::text[]);

end;
$function$;

revoke all on function public.nexus_send_profile_message(uuid, uuid, uuid, uuid, text, bigint, uuid[]) from public, authenticated;
revoke all on function public.nexus_delete_profile_message(uuid, uuid, uuid, uuid) from public, authenticated;
revoke all on function public.nexus_set_profile_message_favorite(uuid, uuid, uuid, uuid, boolean) from public, authenticated;
grant execute on function public.nexus_send_profile_message(uuid, uuid, uuid, uuid, text, bigint, uuid[]) to anon;
grant execute on function public.nexus_delete_profile_message(uuid, uuid, uuid, uuid) to anon;
grant execute on function public.nexus_set_profile_message_favorite(uuid, uuid, uuid, uuid, boolean) to anon;

notify pgrst, 'reload schema';
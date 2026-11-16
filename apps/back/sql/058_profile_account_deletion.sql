-- Destructive account/profile actions. Relational rows are removed atomically;
-- media metadata is retained long enough for the normal storage cleanup worker.

alter table public.media_files
  alter column owner_user_id drop not null;

alter table public.media_files
  drop constraint if exists media_files_owner_user_id_fkey;

alter table public.media_files
  add constraint media_files_owner_user_id_fkey
  foreign key (owner_user_id) references public.accounts(id)
  on delete set null deferrable initially deferred;

create or replace function public.nexus_delete_profile(
  p_user_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_next_profile_id uuid;
  v_is_shared_profile boolean := false;
  v_now_ms bigint := floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  if p_user_id is null or p_profile_id is null then
    raise exception 'INVALID_PROFILE_DELETE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select exists (
    select 1
    from public.account_profiles membership
    where membership.profile_id = p_profile_id
      and membership.account_id <> p_user_id
  )
  into v_is_shared_profile;

  if v_current_profile_id = p_profile_id then
    select membership.profile_id
    into v_next_profile_id
    from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id <> p_profile_id
    order by membership.position
    limit 1;

    update public.accounts
    set current_profile_id = v_next_profile_id
    where id = p_user_id;
  end if;

  if v_is_shared_profile then
    -- Removing a profile from one account must not delete content still
    -- owned by another account.
    delete from public.account_profiles
    where account_id = p_user_id and profile_id = p_profile_id;
  else
    -- Mark the profile and owned-community avatars for normal asynchronous
    -- object deletion. Attached editor images are reconciled after FK cascades.
    update public.media_files file
    set status = 'deleting',
        deleting_at_ms = v_now_ms,
        delete_after_ms = null
    where file.owner_user_id = p_user_id
      and (
        (file.purpose = 'profile-avatar'
          and file.resource_type = 'profile'
          and file.resource_id = p_profile_id)
        or
        (file.purpose = 'community-avatar'
          and file.resource_type = 'community'
          and file.resource_id in (
            select relation.community_id
            from public.community_relationships relation
            where relation.profile_id = p_profile_id
              and relation.type = 'owner'
          ))
      );

    delete from public.communities community
    where exists (
      select 1
      from public.community_relationships relation
      where relation.community_id = community.id
        and relation.profile_id = p_profile_id
        and relation.type = 'owner'
    );

    delete from public.profiles
    where id = p_profile_id;
  end if;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);
end;
$function$;

create or replace function public.nexus_delete_account(
  p_user_id uuid,
  p_now_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_user_id is null or p_now_ms is null then
    raise exception 'INVALID_ACCOUNT_DELETE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','refresh_tokens','media_files'
  ]::text[]);

  perform 1
  from public.accounts account
  where account.id = p_user_id
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Only unattached uploads can be deleted immediately. Files that still
  -- belong to a profile shared with another account remain available; the
  -- orphan reconciler removes files whose content is deleted below.
  update public.media_files file
  set status = 'deleting',
      deleting_at_ms = p_now_ms,
      delete_after_ms = null
  where file.owner_user_id = p_user_id
    and file.resource_type is null
    and file.resource_id is null;

  -- Preserve a profile/community if another account still owns that profile.
  delete from public.communities community
  where exists (
    select 1
    from public.community_relationships relation
    join public.account_profiles membership
      on membership.profile_id = relation.profile_id
    where membership.account_id = p_user_id
      and relation.community_id = community.id
      and relation.type = 'owner'
      and not exists (
        select 1
        from public.account_profiles other_membership
        where other_membership.profile_id = membership.profile_id
          and other_membership.account_id <> p_user_id
      )
  );

  delete from public.profiles profile
  using public.account_profiles membership
  where membership.account_id = p_user_id
    and membership.profile_id = profile.id
    and not exists (
      select 1
      from public.account_profiles other_membership
      where other_membership.profile_id = profile.id
        and other_membership.account_id <> p_user_id
    );

  -- Account-owned refresh tokens/preferences/memberships cascade. Media rows
  -- survive with owner_user_id=NULL so object cleanup can still find their keys.
  delete from public.accounts
  where id = p_user_id;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','refresh_tokens','media_files'
  ]::text[]);
end;
$function$;

revoke all on function public.nexus_delete_profile(uuid, uuid) from public, authenticated;
revoke all on function public.nexus_delete_account(uuid, bigint) from public, authenticated;
grant execute on function public.nexus_delete_profile(uuid, uuid) to anon;
grant execute on function public.nexus_delete_account(uuid, bigint) to anon;

notify pgrst, 'reload schema';

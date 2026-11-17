-- Enforce exclusive profile ownership and logical deletion across user data.
-- The feed projection remains a rebuildable derived table. Storage objects are
-- removed asynchronously; their media metadata is retained as a tombstone.

begin;

-- Retain upload metadata when the owning account is logically deleted.
alter table public.media_files
  alter column owner_user_id drop not null;

alter table public.media_files
  drop constraint if exists media_files_owner_user_id_fkey;

alter table public.media_files
  add constraint media_files_owner_user_id_fkey
  foreign key (owner_user_id) references public.accounts(id)
  on delete set null deferrable initially deferred;


do $migration$
declare
  v_table text;
  v_tables text[] := array[
    'accounts',
    'account_profiles',
    'account_preferences',
    'profiles',
    'communities',
    'relationships',
    'community_relationships',
    'profile_posts',
    'profile_settings',
    'profile_activity_preferences',
    'profile_messages',
    'community_forum_topics',
    'community_forum_replies',
    'refresh_tokens',
    'media_files',
    'activity_notification_reads',
    'feed_activities'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'alter table public.%I add column if not exists deleted_at_ms bigint',
      v_table
    );

    execute format(
      'drop policy if exists nexus_active_rows_only on public.%I',
      v_table
    );
    if v_table <> 'media_files' then
      execute format(
        'create policy nexus_active_rows_only on public.%I as restrictive for select to anon using (deleted_at_ms is null)',
        v_table
      );
    end if;
  end loop;
end;
$migration$;

-- A profile has one permanent account owner. Tombstoned ownership rows are
-- retained, so a deleted profile can never be attached to a different account.
create unique index if not exists account_profiles_single_owner_uidx
  on public.account_profiles(profile_id);

-- Existing unique constraints for account email and public profile/community
-- URLs are intentionally retained. Tombstones continue reserving those values.
-- Account deletion marks the account itself. The cascade trigger retains all
-- dependent domain records and clears the current-profile selection.
create or replace function public.nexus_delete_account(
  p_user_id uuid,
  p_now_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_deleted_count integer;
begin
  if p_user_id is null or p_now_ms is null then
    raise exception 'INVALID_ACCOUNT_DELETE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','refresh_tokens','media_files'
  ]::text[]);

  update public.accounts as account
  set current_profile_id = null,
      deleted_at_ms = p_now_ms
  where account.id = p_user_id
    and account.deleted_at_ms is null;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> 1 then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','refresh_tokens','media_files'
  ]::text[]);
end;
$function$;

-- Notification read state is private server-owned account data. Grant only
-- the backend role access, protected by the same internal request header.
grant select, update on public.activity_notification_reads to anon;
drop policy if exists nexus_server_access on public.activity_notification_reads;
create policy nexus_server_access
  on public.activity_notification_reads
  for all to anon
  using (private.nexus_server_request_authorized())
  with check (private.nexus_server_request_authorized());

-- Preserve the activity_id FK: feed rows remain as tombstones, so read history
-- retains referential integrity without cascading physical deletion.

create or replace function private.nexus_soft_delete_row()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_primary_key_predicate text;
  v_deleted_at_ms bigint :=
    floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  if tg_table_name = 'media_files' then
    -- Keep the media row visible to the cleanup worker until the Storage
    -- object has been removed. nexus_finish_upload_deletions tombstones it.
    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_deleted_at_ms),
        delete_after_ms = null
    where file.id = old.id
      and file.deleted_at_ms is null;
    return null;
  end if;

  if tg_table_name = 'feed_activities' then
    update public.activity_notification_reads as read_state
    set deleted_at_ms = coalesce(read_state.deleted_at_ms, v_deleted_at_ms)
    where read_state.activity_id = old.id
      and read_state.deleted_at_ms is null;
  end if;

  select pg_catalog.string_agg(
    pg_catalog.format(
      'target.%I is not distinct from (($2 ->> %L)::%s)',
      attribute.attname,
      attribute.attname,
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)
    ),
    ' and ' order by key_column.ordinality
  )
  into v_primary_key_predicate
  from pg_catalog.pg_index as index_definition
  cross join lateral pg_catalog.unnest(index_definition.indkey)
    with ordinality as key_column(attnum, ordinality)
  join pg_catalog.pg_attribute as attribute
    on attribute.attrelid = index_definition.indrelid
   and attribute.attnum = key_column.attnum
  where index_definition.indrelid = tg_relid
    and index_definition.indisprimary;

  if v_primary_key_predicate is null then
    raise exception 'SOFT_DELETE_PRIMARY_KEY_REQUIRED: %.%',
      tg_table_schema, tg_table_name;
  end if;

  execute pg_catalog.format(
    'update %I.%I as target
        set deleted_at_ms = coalesce(target.deleted_at_ms, $1)
      where %s
        and target.deleted_at_ms is null',
    tg_table_schema,
    tg_table_name,
    v_primary_key_predicate
  )
  using v_deleted_at_ms, pg_catalog.to_jsonb(old);

  return null;
end;
$function$;

create or replace function private.nexus_propagate_soft_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_deleted_at_ms bigint := new.deleted_at_ms;
  v_now_ms bigint := floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  if old.deleted_at_ms is not null or new.deleted_at_ms is null then
    return new;
  end if;

  if tg_table_name = 'accounts' then
    update public.profiles as profile
    set deleted_at_ms = v_deleted_at_ms
    where profile.deleted_at_ms is null
      and profile.id in (
        select membership.profile_id
        from public.account_profiles as membership
        where membership.account_id = new.id
          and membership.deleted_at_ms is null
      );

    update public.account_profiles as membership
    set deleted_at_ms = v_deleted_at_ms
    where membership.account_id = new.id
      and membership.deleted_at_ms is null;

    update public.account_preferences as preferences
    set deleted_at_ms = v_deleted_at_ms
    where preferences.account_id = new.id
      and preferences.deleted_at_ms is null;

    update public.refresh_tokens as token
    set deleted_at_ms = v_deleted_at_ms
    where token.user_id = new.id
      and token.deleted_at_ms is null;

    update public.activity_notification_reads as read_state
    set deleted_at_ms = v_deleted_at_ms
    where read_state.account_id = new.id
      and read_state.deleted_at_ms is null;

    -- Profile-owned files have already been detached by the profile cascade.
    -- Retain media attached to surviving community resources, even when the
    -- deleting account originally uploaded the object.
    update public.media_files as file
    set owner_user_id = null,
        status = case
          when file.resource_type is null or file.resource_id is null
            then 'deleting'
          else file.status
        end,
        deleting_at_ms = case
          when file.resource_type is null or file.resource_id is null
            then coalesce(file.deleting_at_ms, v_now_ms)
          else file.deleting_at_ms
        end,
        delete_after_ms = case
          when file.resource_type is null or file.resource_id is null
            then null
          else file.delete_after_ms
        end
    where file.owner_user_id = new.id
      and file.deleted_at_ms is null;

  elsif tg_table_name = 'account_profiles' then
    -- A membership cannot be removed independently: the profile has one
    -- permanent account owner, so deleting its ownership row deletes the profile too.
    update public.profiles as profile
    set deleted_at_ms = v_deleted_at_ms
    where profile.id = new.profile_id
      and profile.deleted_at_ms is null;

  elsif tg_table_name = 'profiles' then
    update public.accounts as account
    set current_profile_id = null
    where account.current_profile_id = new.id
      and account.deleted_at_ms is null;

    -- Communities owned by this profile are part of its retained history.
    update public.communities as community
    set deleted_at_ms = v_deleted_at_ms
    where community.deleted_at_ms is null
      and community.id in (
        select relation.community_id
        from public.community_relationships as relation
        where relation.profile_id = new.id
          and relation.type = 'owner'
          and relation.deleted_at_ms is null
      );

    update public.relationships as relation
    set deleted_at_ms = v_deleted_at_ms,
        requested_by = case when relation.requested_by = new.id then null else relation.requested_by end,
        blocked_by = case when relation.blocked_by = new.id then null else relation.blocked_by end
    where relation.deleted_at_ms is null
      and (relation.profile_id = new.id or relation.related_profile_id = new.id);

    update public.relationships as relation
    set requested_by = null,
        blocked_by = null
    where relation.deleted_at_ms is null
      and (relation.requested_by = new.id or relation.blocked_by = new.id);

    update public.community_relationships as relation
    set deleted_at_ms = v_deleted_at_ms,
        requested_by = case when relation.requested_by = new.id then null else relation.requested_by end,
        blocked_by = case when relation.blocked_by = new.id then null else relation.blocked_by end
    where relation.profile_id = new.id
      and relation.deleted_at_ms is null;

    update public.community_relationships as relation
    set requested_by = null,
        blocked_by = null
    where relation.deleted_at_ms is null
      and relation.profile_id <> new.id
      and (relation.requested_by = new.id or relation.blocked_by = new.id);

    update public.profile_posts as post
    set deleted_at_ms = v_deleted_at_ms
    where post.profile_id = new.id
      and post.deleted_at_ms is null;

    update public.profile_settings as settings
    set deleted_at_ms = v_deleted_at_ms
    where settings.profile_id = new.id
      and settings.deleted_at_ms is null;

    update public.profile_activity_preferences as preferences
    set deleted_at_ms = v_deleted_at_ms
    where preferences.profile_id = new.id
      and preferences.deleted_at_ms is null;

    update public.profile_messages as message
    set deleted_at_ms = v_deleted_at_ms
    where (message.from_profile_id = new.id or message.to_profile_id = new.id)
      and message.deleted_at_ms is null;

    update public.community_forum_topics as topic
    set deleted_at_ms = v_deleted_at_ms
    where topic.profile_id = new.id
      and topic.deleted_at_ms is null;

    update public.community_forum_replies as reply
    set deleted_at_ms = v_deleted_at_ms
    where reply.profile_id = new.id
      and reply.deleted_at_ms is null;

    update public.account_profiles as membership
    set deleted_at_ms = v_deleted_at_ms
    where membership.profile_id = new.id
      and membership.deleted_at_ms is null;

    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and (
        (file.resource_type = 'profile' and file.resource_id = new.id)
        or file.message_from_profile_id = new.id
        or file.message_to_profile_id = new.id
      );

  elsif tg_table_name = 'communities' then
    update public.community_relationships as relation
    set deleted_at_ms = v_deleted_at_ms
    where relation.community_id = new.id
      and relation.deleted_at_ms is null;

    update public.community_forum_topics as topic
    set deleted_at_ms = v_deleted_at_ms
    where topic.community_id = new.id
      and topic.deleted_at_ms is null;

    update public.community_forum_replies as reply
    set deleted_at_ms = v_deleted_at_ms
    where reply.community_id = new.id
      and reply.deleted_at_ms is null;

    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and file.resource_type = 'community'
      and file.resource_id = new.id;

  elsif tg_table_name = 'community_forum_topics' then
    update public.community_forum_replies as reply
    set deleted_at_ms = v_deleted_at_ms
    where reply.topic_id = new.id
      and reply.deleted_at_ms is null;

    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and file.resource_type = 'community-forum-topic'
      and file.resource_id = new.id;

  elsif tg_table_name = 'profile_posts' then
    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and file.resource_type = 'profile-post'
      and file.resource_id = new.id;

  elsif tg_table_name = 'profile_messages' then
    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and file.resource_type = 'profile-message'
      and file.resource_id = new.id;

  elsif tg_table_name = 'community_forum_replies' then
    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.deleted_at_ms is null
      and file.resource_type = 'community-forum-reply'
      and file.resource_id = new.id;
  end if;

  return new;
end;
$function$;

do $migration$
declare
  v_table text;
  v_tables text[] := array[
    'accounts',
    'account_profiles',
    'account_preferences',
    'profiles',
    'communities',
    'relationships',
    'community_relationships',
    'profile_posts',
    'profile_settings',
    'profile_activity_preferences',
    'profile_messages',
    'community_forum_topics',
    'community_forum_replies',
    'refresh_tokens',
    'media_files',
    'activity_notification_reads',
    'feed_activities'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'drop trigger if exists nexus_soft_delete_before_delete on public.%I',
      v_table
    );
    execute format(
      'create trigger nexus_soft_delete_before_delete
         before delete on public.%I
         for each row execute function private.nexus_soft_delete_row()',
      v_table
    );

    if v_table <> 'media_files' then
      execute format(
        'drop trigger if exists nexus_soft_delete_cascade on public.%I',
        v_table
      );
      execute format(
        'create trigger nexus_soft_delete_cascade
           after update of deleted_at_ms on public.%I
           for each row
           when (old.deleted_at_ms is null and new.deleted_at_ms is not null)
           execute function private.nexus_propagate_soft_delete()',
        v_table
      );
    end if;
  end loop;
end;
$migration$;

-- Feed rows are a derived projection, not the source records. Remove their
-- projection when a source relation/post is tombstoned.
create or replace function private.nexus_remove_deleted_feed_projection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.deleted_at_ms is null then
    return new;
  end if;

  if tg_table_name = 'relationships' then
    delete from public.feed_activities
    where id = 'friend:' || new.profile_id::text || ':' || new.related_profile_id::text;
  elsif tg_table_name = 'community_relationships' then
    delete from public.feed_activities
    where id = 'community:' || new.profile_id::text || ':' || new.community_id::text;
    if new.type = 'owner' then
      delete from public.feed_activities
      where id = 'community-created:' || new.community_id::text;
    end if;
  elsif tg_table_name = 'profile_posts' then
    delete from public.feed_activities
    where id = 'post:' || new.id::text;
  end if;

  return new;
end;
$function$;

drop trigger if exists zz_nexus_soft_delete_feed_cleanup on public.relationships;
create trigger zz_nexus_soft_delete_feed_cleanup
  after update of deleted_at_ms on public.relationships
  for each row
  when (old.deleted_at_ms is null and new.deleted_at_ms is not null)
  execute function private.nexus_remove_deleted_feed_projection();

drop trigger if exists zz_nexus_soft_delete_feed_cleanup on public.community_relationships;
create trigger zz_nexus_soft_delete_feed_cleanup
  after update of deleted_at_ms on public.community_relationships
  for each row
  when (old.deleted_at_ms is null and new.deleted_at_ms is not null)
  execute function private.nexus_remove_deleted_feed_projection();

drop trigger if exists zz_nexus_soft_delete_feed_cleanup on public.profile_posts;
create trigger zz_nexus_soft_delete_feed_cleanup
  after update of deleted_at_ms on public.profile_posts
  for each row
  when (old.deleted_at_ms is null and new.deleted_at_ms is not null)
  execute function private.nexus_remove_deleted_feed_projection();

create or replace function private.nexus_restore_soft_deleted_feed_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  update public.feed_activities as activity
  set type = new.type,
      actor_profile_id = new.actor_profile_id,
      target_profile_id = new.target_profile_id,
      profile_post_id = new.profile_post_id,
      community_id = new.community_id,
      role = new.role,
      updated_at_ms = new.updated_at_ms,
      deleted_at_ms = null
  where activity.id = new.id
    and activity.deleted_at_ms is not null;

  if found then
    return null;
  end if;
  return new;
end;
$function$;

drop trigger if exists nexus_restore_soft_deleted_feed_activity on public.feed_activities;
create trigger nexus_restore_soft_deleted_feed_activity
  before insert on public.feed_activities
  for each row execute function private.nexus_restore_soft_deleted_feed_activity();

-- Revive a relationship tombstone instead of trying to insert a duplicate
-- primary key when two profiles reconnect or a community member rejoins.
create or replace function private.nexus_restore_soft_deleted_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  if tg_table_name = 'relationships' then
    update public.relationships as existing
    set type = new.type,
        requested_by = new.requested_by,
        blocked_by = new.blocked_by,
        updated_at_ms = new.updated_at_ms,
        deleted_at_ms = null
    where existing.profile_id = new.profile_id
      and existing.related_profile_id = new.related_profile_id
      and existing.deleted_at_ms is not null;
  else
    update public.community_relationships as existing
    set type = new.type,
        requested_by = new.requested_by,
        blocked_by = new.blocked_by,
        updated_at_ms = new.updated_at_ms,
        deleted_at_ms = null
    where existing.profile_id = new.profile_id
      and existing.community_id = new.community_id
      and existing.deleted_at_ms is not null;
  end if;

  if found then
    return null;
  end if;
  return new;
end;
$function$;

drop trigger if exists nexus_restore_soft_deleted_relationship on public.relationships;
create trigger nexus_restore_soft_deleted_relationship
  before insert on public.relationships
  for each row execute function private.nexus_restore_soft_deleted_relationship();

drop trigger if exists nexus_restore_soft_deleted_relationship on public.community_relationships;
create trigger nexus_restore_soft_deleted_relationship
  before insert on public.community_relationships
  for each row execute function private.nexus_restore_soft_deleted_relationship();

-- Profile removal is profile deletion. There is no unlink operation that can
-- leave an ownerless public profile behind.
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
  v_next_position integer;
begin
  if p_account_id is null or p_profile_id is null
     or p_action not in ('select', 'add', 'remove') then
    raise exception 'INVALID_ACCOUNT_PROFILE_CHANGE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_account_id
    and account.deleted_at_ms is null
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_action = 'select' then
    if not exists (
      select 1 from public.account_profiles membership
      where membership.account_id = p_account_id
        and membership.profile_id = p_profile_id
        and membership.deleted_at_ms is null
    ) then
      raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
    end if;

    update public.accounts
    set current_profile_id = p_profile_id
    where id = p_account_id
      and deleted_at_ms is null;

    perform private.nexus_bump_collection_versions(array['accounts']::text[]);
    return;
  end if;

  if p_action = 'add' then
    if not exists (
      select 1 from public.profiles profile
      where profile.id = p_profile_id
        and profile.deleted_at_ms is null
    ) then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.account_profiles membership
      where membership.profile_id = p_profile_id
        and membership.account_id <> p_account_id
        and membership.deleted_at_ms is null
    ) then
      raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
    end if;

    select coalesce(max(membership.position) + 1, 0)
    into v_next_position
    from public.account_profiles membership
    where membership.account_id = p_account_id
      and membership.deleted_at_ms is null;

    begin
      insert into public.account_profiles (account_id, profile_id, position)
      values (p_account_id, p_profile_id, v_next_position)
      on conflict (account_id, profile_id) do nothing;
    exception
      when unique_violation then
        raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
    end;

    if p_make_current or v_current_profile_id is null then
      update public.accounts
      set current_profile_id = p_profile_id
      where id = p_account_id
        and deleted_at_ms is null;
    end if;

    perform private.nexus_bump_collection_versions(array['accounts']::text[]);
    return;
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_account_id
      and membership.profile_id = p_profile_id
      and membership.deleted_at_ms is null
  ) then
    return;
  end if;

  update public.profiles
  set deleted_at_ms = floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint
  where id = p_profile_id
    and deleted_at_ms is null;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);
end;
$function$;

-- Replace the earlier shared-profile branch with an unconditional logical
-- deletion of the exclusively owned profile.
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
  v_deleted_at_ms bigint :=
    floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
  v_deleted_count integer;
begin
  if p_user_id is null or p_profile_id is null then
    raise exception 'INVALID_PROFILE_DELETE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);

  perform account.id
  from public.accounts as account
  where account.id = p_user_id
    and account.deleted_at_ms is null
  for update;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
      and membership.deleted_at_ms is null
  ) then
    if not exists (
      select 1 from public.profiles profile
      where profile.id = p_profile_id
        and profile.deleted_at_ms is null
    ) then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  update public.profiles
  set deleted_at_ms = v_deleted_at_ms
  where id = p_profile_id
    and deleted_at_ms is null;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> 1 then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);
end;
$function$;

create or replace function public.nexus_delete_pending_upload(
  p_user_id uuid,
  p_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_deleted integer;
  v_now_ms bigint :=
    floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);

  update public.media_files as file
  set status = 'deleting',
      deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
      delete_after_ms = null
  where file.id = p_id
    and file.owner_user_id = p_user_id
    and file.status = 'pending'
    and file.deleted_at_ms is null
    and file.resource_type is null
    and file.resource_id is null;

  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  end if;
end;
$function$;


-- Let the logical-deletion cascade mark attached editor images for asynchronous
-- cleanup. These RPCs must not detach files before the row tombstone triggers run.
create or replace function public.nexus_delete_community_forum_reply(
  p_user_id uuid,
  p_community_id uuid,
  p_reply_id uuid,
  p_actor_profile_id uuid,
  p_updated_at_ms bigint
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_author_profile_id uuid;
  v_topic_id uuid;
begin
  perform private.nexus_lock_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );

  if p_updated_at_ms is null then
    raise exception 'FORUM_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  v_actor_role := private.nexus_forum_actor_role(
    p_user_id, p_community_id, p_actor_profile_id, false, false
  );

  select reply.topic_id, reply.profile_id
  into v_topic_id, v_author_profile_id
  from public.community_forum_replies reply
  where reply.id = p_reply_id
    and reply.community_id = p_community_id
  for update;

  if not found then
    raise exception 'FORUM_REPLY_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform topic.id
  from public.community_forum_topics topic
  where topic.id = v_topic_id
    and topic.community_id = p_community_id
  for update;

  if not found then
    raise exception 'FORUM_TOPIC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_author_profile_id <> p_actor_profile_id
     and coalesce(v_actor_role, '') not in ('owner', 'moderator') then
    raise exception 'FORUM_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  delete from public.community_forum_replies
  where id = p_reply_id
    and community_id = p_community_id;

  update public.community_forum_topics
  set updated_at_ms = p_updated_at_ms
  where id = v_topic_id
    and community_id = p_community_id;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_actor_profile_id;

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );

  return v_topic_id;
end;
$function$;

create or replace function public.nexus_delete_community_forum_topic(
  p_user_id uuid,
  p_community_id uuid,
  p_topic_id uuid,
  p_actor_profile_id uuid,
  p_updated_at_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_role text;
  v_author_profile_id uuid;
begin
  perform private.nexus_lock_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );

  if p_updated_at_ms is null then
    raise exception 'FORUM_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  v_actor_role := private.nexus_forum_actor_role(
    p_user_id, p_community_id, p_actor_profile_id, false, false
  );

  select topic.profile_id
  into v_author_profile_id
  from public.community_forum_topics topic
  where topic.id = p_topic_id
    and topic.community_id = p_community_id
  for update;

  if not found then
    raise exception 'FORUM_TOPIC_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_author_profile_id <> p_actor_profile_id
     and coalesce(v_actor_role, '') not in ('owner', 'moderator') then
    raise exception 'FORUM_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  delete from public.community_forum_topics topic
  where topic.id = p_topic_id
    and topic.community_id = p_community_id;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_actor_profile_id;

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );
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
  perform private.nexus_lock_collection_versions(
    array['media_files', 'profile_messages']::text[]
  );

  if p_user_id is null or p_recipient_profile_id is null
     or p_message_id is null or p_actor_profile_id is null then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.accounts account where account.id = p_user_id
  ) then
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

  delete from public.profile_messages
  where id = p_message_id
    and to_profile_id = p_recipient_profile_id;

  perform private.nexus_bump_collection_versions(
    array['media_files', 'profile_messages']::text[]
  );
end;
$function$;

-- Authenticated sessions can linger until token expiry, so the security-definer
-- notification functions must independently reject logically deleted accounts.
create or replace function public.nexus_get_activity_feed_page(
  p_user_id uuid,
  p_limit integer default 10,
  p_cursor_updated_at_ms bigint default null,
  p_cursor_id text default null
)
returns table (
  id text,
  type text,
  updated_at_ms bigint,
  profile jsonb,
  friend jsonb,
  community jsonb,
  content text,
  role text
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'ACTIVITY_FEED_USER_REQUIRED' using errcode = '22023';
  end if;

  if (p_cursor_updated_at_ms is null) <> (p_cursor_id is null) then
    raise exception 'ACTIVITY_FEED_CURSOR_INVALID' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts a where a.id = p_user_id and a.deleted_at_ms is null) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  with account_context as (
    select
      a.id as account_id,
      case when exists (
        select 1 from public.account_profiles active_membership
        where active_membership.account_id = a.id
          and active_membership.profile_id = a.current_profile_id
          and active_membership.deleted_at_ms is null
      ) then a.current_profile_id end as active_profile_id
    from public.accounts a
    where a.id = p_user_id
      and a.deleted_at_ms is null
  ),
  account_owned_profiles as (
    select p.id as profile_id, p.type
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    where ap.account_id = p_user_id
      and ap.deleted_at_ms is null
      and p.deleted_at_ms is null
  ),
  owned_profiles as (
    select p.id as profile_id, p.type
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    cross join account_context context
    where ap.account_id = p_user_id
      and ap.profile_id = context.active_profile_id
      and ap.deleted_at_ms is null
      and p.deleted_at_ms is null
  ),
  friend_profiles as (
    select distinct
      case
        when active_profile.id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end as profile_id
    from public.relationships relationship
    cross join account_context context
    join public.profiles active_profile
      on active_profile.id = context.active_profile_id
    join public.profiles friend_profile
      on friend_profile.id = case
        when active_profile.id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end
    where relationship.type = 'connection'
      and active_profile.id in (relationship.profile_id, relationship.related_profile_id)
      and friend_profile.type = active_profile.type
      and not exists (
        select 1 from account_owned_profiles already_owned
        where already_owned.profile_id = friend_profile.id
      )
  ),
  visible_profiles as (
    select profile_id from owned_profiles
    union
    select profile_id from friend_profiles
  ),
  feed_events as (
    select
      activity.*,
      case
        when activity.type = 'friend_connected'
          and exists (
            select 1 from owned_profiles owned
            where owned.profile_id = activity.actor_profile_id
          )
          then activity.actor_profile_id
        when activity.type = 'friend_connected'
          then activity.target_profile_id
        else activity.actor_profile_id
      end as viewer_profile_id,
      case
        when activity.type = 'friend_connected'
          and exists (
            select 1 from owned_profiles owned
            where owned.profile_id = activity.actor_profile_id
          )
          then activity.target_profile_id
        when activity.type = 'friend_connected'
          then activity.actor_profile_id
        else null
      end as friend_profile_id
    from public.feed_activities activity
    where activity.deleted_at_ms is null
  )
  select
    event.id,
    event.type,
    event.updated_at_ms,
    jsonb_build_object(
      'id', actor.id,
      'name', actor.name,
      'url', actor.url,
      'picture', actor.picture,
      'about', actor.about,
      'type', actor.type,
      'createdAt', actor.created_at_ms,
      'lastActivity', actor.last_activity_ms
    ) as profile,
    case when friend.id is null then null else jsonb_build_object(
      'id', friend.id,
      'name', friend.name,
      'url', friend.url,
      'picture', friend.picture,
      'about', friend.about,
      'type', friend.type,
      'createdAt', friend.created_at_ms,
      'lastActivity', friend.last_activity_ms
    ) end as friend,
    case when community.id is null then null else jsonb_build_object(
      'id', community.id,
      'name', community.name,
      'url', community.url,
      'picture', community.picture,
      'about', community.about,
      'type', community.type,
      'privacy', community.privacy,
      'createdAt', community.created_at_ms,
      'lastActivity', community.last_activity_ms
    ) end as community,
    post.content,
    event.role
  from feed_events event
  cross join account_context context
  join public.profiles actor on actor.id = event.viewer_profile_id
  left join public.profiles friend on friend.id = event.friend_profile_id
  left join public.communities community on community.id = event.community_id
  left join public.profile_posts post
    on post.id = event.profile_post_id
   and post.profile_id = actor.id
  where
    (
      (
        event.type = 'friend_connected'
        and exists (
          select 1 from owned_profiles owned
          where owned.profile_id = event.viewer_profile_id
        )
        and not exists (
          select 1 from owned_profiles owned
          where owned.profile_id = event.friend_profile_id
        )
        and friend.id is not null
        and friend.type = actor.type
      )
      or
      (
        event.type <> 'friend_connected'
        and exists (
          select 1 from visible_profiles visible
          where visible.profile_id = actor.id
        )
      )
    )
    and (
      not exists (
        select 1 from public.profile_settings publisher_settings
        where publisher_settings.profile_id = actor.id
      )
      or exists (
        select 1
        from public.profile_activity_preferences publisher_preference
        where publisher_preference.profile_id = actor.id
          and publisher_preference.activity_type = event.type
          and publisher_preference.publish_activity = true
      )
    )
    and (
      (
        event.type <> 'friend_connected'
        and exists (
          select 1 from owned_profiles owned
          where owned.profile_id = actor.id
        )
      )
      or not exists (
        select 1
        from public.profile_settings viewer_settings
        where viewer_settings.profile_id = context.active_profile_id
      )
      or exists (
        select 1
        from public.profile_activity_preferences viewer_preference
        where viewer_preference.profile_id = context.active_profile_id
          and viewer_preference.activity_type = event.type
          and viewer_preference.show_friend_activity = true
      )
    )
    and (
      event.type not in ('community_created', 'community_membership')
      or (
        community.id is not null
        and community.type = actor.type
        and (
          exists (
            select 1 from owned_profiles owned
            where owned.profile_id = actor.id
          )
          or community.privacy = 'public'
        )
      )
    )
    and (
      event.type <> 'profile_post'
      or post.id is not null
    )
    and (
      p_cursor_updated_at_ms is null
      or event.updated_at_ms < p_cursor_updated_at_ms
      or (
        event.updated_at_ms = p_cursor_updated_at_ms
        and event.id > p_cursor_id
      )
    )
  order by event.updated_at_ms desc, event.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50) + 1;
end;
$function$;


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
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_user_id is null or not exists (
    select 1 from public.accounts as account
    where account.id = p_user_id
      and account.deleted_at_ms is null
  ) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return;
  end if;

  return query
  select read_state.activity_id
  from public.activity_notification_reads as read_state
  where read_state.account_id = p_user_id
    and read_state.activity_id = any(p_activity_ids)
    and read_state.deleted_at_ms is null;
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
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_user_id is null or p_read_at_ms is null
     or coalesce(cardinality(p_activity_ids), 0) > 50 then
    raise exception 'ACTIVITY_READ_INPUT_INVALID' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.accounts as account
    where account.id = p_user_id
      and account.deleted_at_ms is null
  ) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return 0;
  end if;

  insert into public.activity_notification_reads (account_id, activity_id, read_at_ms)
  select p_user_id, activity.id, p_read_at_ms
  from public.feed_activities as activity
  where activity.id = any(p_activity_ids)
    and exists (
      select 1
      from public.nexus_get_activity_feed_page(p_user_id, 50, null, null) as visible
      where visible.id = activity.id
    )
  on conflict (account_id, activity_id) do update
    set read_at_ms = excluded.read_at_ms,
        deleted_at_ms = null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- Storage cleanup remains asynchronous, but finished file metadata is
-- tombstoned rather than physically removed.
create or replace function public.nexus_claim_expired_uploads(
  p_now_ms bigint,
  p_claim_lease_ms bigint,
  p_safe_age_ms bigint,
  p_orphan_avatar_retention_ms bigint,
  p_limit integer default 1000
)
returns setof public.media_files
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_now_ms is null or p_claim_lease_ms is null or p_safe_age_ms is null
     or p_orphan_avatar_retention_ms is null or p_limit is null or p_limit < 1 then
    raise exception 'INVALID_UPLOAD_CLEANUP_CLAIM' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array['media_files']::text[]);

  return query
  with candidates as (
    select file.id
    from public.media_files as file
    where file.deleted_at_ms is null
      and (
        (file.status = 'deleting'
          and (file.purpose <> 'editor-image'
            or (file.resource_type is null and file.resource_id is null))
          and coalesce(file.deleting_at_ms, 0) <= p_now_ms - p_claim_lease_ms
          and (file.delete_after_ms is null or file.delete_after_ms <= p_now_ms))
        or (file.purpose = 'editor-image' and file.status = 'ready'
          and file.resource_type is null and file.resource_id is null
          and file.expires_at_ms is not null and file.expires_at_ms <= p_now_ms)
        or (file.status = 'pending'
          and file.created_at_ms + p_safe_age_ms <= p_now_ms)
        or (file.status = 'ready' and file.purpose = 'editor-image' and (
          (file.resource_type = 'profile' and not exists (
            select 1 from public.profiles as resource
            where resource.id = file.resource_id
          ))
          or (file.resource_type = 'community' and not exists (
            select 1 from public.communities as resource
            where resource.id = file.resource_id
          ))
          or (file.resource_type = 'profile-message' and not exists (
            select 1 from public.profile_messages as resource
            where resource.id = file.resource_id
          ))
          or (file.resource_type = 'profile-post' and not exists (
            select 1 from public.profile_posts as resource
            where resource.id = file.resource_id
          ))
          or (file.resource_type = 'community-forum-topic' and not exists (
            select 1 from public.community_forum_topics as resource
            where resource.id = file.resource_id
          ))
          or (file.resource_type = 'community-forum-reply' and not exists (
            select 1 from public.community_forum_replies as resource
            where resource.id = file.resource_id
          ))
        ))
        or (file.status = 'ready' and file.purpose in ('profile-avatar', 'community-avatar')
          and (
            (file.purpose = 'profile-avatar' and file.resource_type = 'profile'
              and not exists (
                select 1 from public.profiles as resource
                where resource.id = file.resource_id
              ))
            or (file.purpose = 'community-avatar' and file.resource_type = 'community'
              and not exists (
                select 1 from public.communities as resource
                where resource.id = file.resource_id
              ))
          )
          and coalesce(file.completed_at_ms, file.created_at_ms)
            + p_orphan_avatar_retention_ms <= p_now_ms)
        or (file.purpose <> 'editor-image' and file.status = 'ready'
          and file.resource_type is null
          and coalesce(file.completed_at_ms, file.created_at_ms)
            + p_orphan_avatar_retention_ms <= p_now_ms)
      )
    order by file.created_at_ms, file.id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = p_now_ms,
        delete_after_ms = null
    from candidates
    where file.id = candidates.id
      and file.deleted_at_ms is null
    returning file.*
  )
  select * from claimed;

  if found then
    perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  end if;
end;
$function$;

create or replace function public.nexus_finish_upload_deletions(p_claims jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_deleted integer;
  v_finished_at_ms bigint :=
    floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;
begin
  if p_claims is null or jsonb_typeof(p_claims) <> 'array' then
    raise exception 'INVALID_UPLOAD_DELETION_CLAIMS' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array['media_files']::text[]);

  update public.media_files as file
  set deleted_at_ms = coalesce(file.deleted_at_ms, v_finished_at_ms)
  from jsonb_to_recordset(p_claims) as claim(id uuid, deleting_at_ms bigint)
  where file.id = claim.id
    and file.status = 'deleting'
    and file.deleted_at_ms is null
    and file.deleting_at_ms = claim.deleting_at_ms
    and (
      file.purpose <> 'editor-image'
      or (file.resource_type is null and file.resource_id is null)
      or not (
        case file.resource_type
          when 'profile' then exists (
            select 1 from public.profiles as resource
            where resource.id = file.resource_id
          )
          when 'community' then exists (
            select 1 from public.communities as resource
            where resource.id = file.resource_id
          )
          when 'profile-message' then exists (
            select 1 from public.profile_messages as resource
            where resource.id = file.resource_id
          )
          when 'profile-post' then exists (
            select 1 from public.profile_posts as resource
            where resource.id = file.resource_id
          )
          when 'community-forum-topic' then exists (
            select 1 from public.community_forum_topics as resource
            where resource.id = file.resource_id
          )
          when 'community-forum-reply' then exists (
            select 1 from public.community_forum_replies as resource
            where resource.id = file.resource_id
          )
          else false
        end
      )
    );

  get diagnostics v_deleted = row_count;
  if v_deleted > 0 then
    perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  end if;
  return v_deleted;
end;
$function$;

revoke all on function private.nexus_soft_delete_row() from public, authenticated;
revoke all on function private.nexus_propagate_soft_delete() from public, authenticated;
revoke all on function private.nexus_remove_deleted_feed_projection() from public, authenticated;
revoke all on function private.nexus_restore_soft_deleted_relationship() from public, authenticated;
revoke all on function private.nexus_restore_soft_deleted_feed_activity() from public, authenticated;
grant execute on function private.nexus_soft_delete_row() to anon;
grant execute on function private.nexus_propagate_soft_delete() to anon;
grant execute on function private.nexus_remove_deleted_feed_projection() to anon;
grant execute on function private.nexus_restore_soft_deleted_relationship() to anon;
grant execute on function private.nexus_restore_soft_deleted_feed_activity() to anon;

revoke all on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) from public, authenticated;
revoke all on function public.nexus_delete_profile(uuid, uuid) from public, authenticated;
revoke all on function public.nexus_delete_account(uuid, bigint) from public, authenticated;
revoke all on function public.nexus_get_activity_read_ids(uuid, text[]) from public, authenticated;
revoke all on function public.nexus_mark_activities_read(uuid, text[], bigint) from public, authenticated;
revoke all on function public.nexus_claim_expired_uploads(bigint, bigint, bigint, bigint, integer) from public, authenticated;
revoke all on function public.nexus_finish_upload_deletions(jsonb) from public, authenticated;
revoke all on function public.nexus_delete_pending_upload(uuid, uuid) from public, authenticated;

grant execute on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) to anon;
grant execute on function public.nexus_delete_profile(uuid, uuid) to anon;
grant execute on function public.nexus_delete_account(uuid, bigint) to anon;
grant execute on function public.nexus_get_activity_read_ids(uuid, text[]) to anon;
grant execute on function public.nexus_mark_activities_read(uuid, text[], bigint) to anon;
grant execute on function public.nexus_claim_expired_uploads(bigint, bigint, bigint, bigint, integer) to anon;
grant execute on function public.nexus_finish_upload_deletions(jsonb) to anon;
grant execute on function public.nexus_delete_pending_upload(uuid, uuid) to anon;

notify pgrst, 'reload schema';

commit;

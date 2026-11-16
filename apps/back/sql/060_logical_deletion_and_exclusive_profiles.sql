-- Enforce exclusive profile ownership and logical deletion across user data.
-- The feed projection remains a rebuildable derived table. Storage objects are
-- removed asynchronously; their media metadata is retained as a tombstone.

begin;

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
    'media_files'
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

-- Allow a new active record to reuse an address previously held by a deleted
-- account/profile/community, without erasing the old record.
alter table public.accounts drop constraint if exists accounts_email_key;
alter table public.profiles drop constraint if exists profiles_url_key;
alter table public.communities drop constraint if exists communities_url_key;

create unique index if not exists accounts_active_email_uidx
  on public.accounts(email)
  where deleted_at_ms is null;
create unique index if not exists profiles_active_url_uidx
  on public.profiles(url)
  where deleted_at_ms is null;
create unique index if not exists communities_active_url_uidx
  on public.communities(url)
  where deleted_at_ms is null;

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

    update public.media_files as file
    set status = 'deleting',
        deleting_at_ms = coalesce(file.deleting_at_ms, v_now_ms),
        delete_after_ms = null,
        resource_type = null,
        resource_id = null,
        message_from_profile_id = null,
        message_to_profile_id = null
    where file.owner_user_id = new.id
      and file.deleted_at_ms is null;

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
    set deleted_at_ms = v_deleted_at_ms
    where relation.deleted_at_ms is null
      and (relation.profile_id = new.id or relation.related_profile_id = new.id);

    update public.community_relationships as relation
    set deleted_at_ms = v_deleted_at_ms
    where relation.profile_id = new.id
      and relation.deleted_at_ms is null;

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
    'media_files'
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

    insert into public.account_profiles (account_id, profile_id, position)
    values (p_account_id, p_profile_id, v_next_position)
    on conflict (account_id, profile_id) do nothing;

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

-- Authenticated sessions can linger until token expiry, so the security-definer
-- notification functions must independently reject logically deleted accounts.
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
  on conflict (account_id, activity_id) do nothing;

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
grant execute on function private.nexus_soft_delete_row() to anon;
grant execute on function private.nexus_propagate_soft_delete() to anon;
grant execute on function private.nexus_remove_deleted_feed_projection() to anon;
grant execute on function private.nexus_restore_soft_deleted_relationship() to anon;

revoke all on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) from public, authenticated;
revoke all on function public.nexus_delete_profile(uuid, uuid) from public, authenticated;
revoke all on function public.nexus_get_activity_read_ids(uuid, text[]) from public, authenticated;
revoke all on function public.nexus_mark_activities_read(uuid, text[], bigint) from public, authenticated;
revoke all on function public.nexus_claim_expired_uploads(bigint, bigint, bigint, bigint, integer) from public, authenticated;
revoke all on function public.nexus_finish_upload_deletions(jsonb) from public, authenticated;
revoke all on function public.nexus_delete_pending_upload(uuid, uuid) from public, authenticated;

grant execute on function public.nexus_change_account_profile(uuid, uuid, text, boolean, uuid) to anon;
grant execute on function public.nexus_delete_profile(uuid, uuid) to anon;
grant execute on function public.nexus_get_activity_read_ids(uuid, text[]) to anon;
grant execute on function public.nexus_mark_activities_read(uuid, text[], bigint) to anon;
grant execute on function public.nexus_claim_expired_uploads(bigint, bigint, bigint, bigint, integer) to anon;
grant execute on function public.nexus_finish_upload_deletions(jsonb) to anon;
grant execute on function public.nexus_delete_pending_upload(uuid, uuid) to anon;

notify pgrst, 'reload schema';

commit;

create or replace function private.nexus_lock_collection_versions(p_collections text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_collections is null or pg_catalog.cardinality(p_collections) = 0 then
    raise exception 'INVALID_COLLECTION_VERSION_SET' using errcode = '22023';
  end if;

  perform version.collection
  from public.nexus_collection_versions version
  where version.collection = any(p_collections)
  order by version.collection
  for update;

  if (
    select count(*) from public.nexus_collection_versions version
    where version.collection = any(p_collections)
  ) <> (
    select count(distinct collection) from pg_catalog.unnest(p_collections) as requested(collection)
  ) then
    raise exception 'MISSING_COLLECTION_VERSION' using errcode = 'P0002';
  end if;
end;
$function$;

create or replace function private.nexus_bump_collection_versions(p_collections text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  update public.nexus_collection_versions version
  set revision = version.revision + 1,
      updated_at = pg_catalog.clock_timestamp()
  where version.collection = any(p_collections);
end;
$function$;

create or replace function private.nexus_forum_actor_role(
  p_user_id uuid,
  p_community_id uuid,
  p_actor_profile_id uuid,
  p_require_member boolean default false,
  p_require_staff boolean default false
)
returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor_type text;
  v_community_type text;
  v_owner_type text;
  v_role text;
begin
  if p_user_id is null or p_community_id is null or p_actor_profile_id is null then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  perform account.id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
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

  select community.type
  into v_community_type
  from public.communities community
  where community.id = p_community_id
  for update;

  if not found then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select owner_profile.type
  into v_owner_type
  from public.community_relationships owner_relationship
  join public.profiles owner_profile
    on owner_profile.id = owner_relationship.profile_id
  where owner_relationship.community_id = p_community_id
    and owner_relationship.type = 'owner'
  limit 1;

  if found then
    v_community_type := v_owner_type;
  end if;

  if v_actor_type <> v_community_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  select relationship.type
  into v_role
  from public.community_relationships relationship
  where relationship.profile_id = p_actor_profile_id
    and relationship.community_id = p_community_id;

  if p_require_staff and coalesce(v_role, '') not in ('owner', 'moderator') then
    raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode = '42501';
  end if;

  if p_require_member and coalesce(v_role, '') not in ('owner', 'moderator', 'connection') then
    raise exception 'COMMUNITY_MEMBER_REQUIRED' using errcode = '42501';
  end if;

  return v_role;
end;
$function$;

create or replace function private.nexus_attach_forum_images(
  p_user_id uuid,
  p_image_ids uuid[],
  p_expires_after_ms bigint,
  p_resource_type text,
  p_resource_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_expected_count integer;
  v_valid_count integer;
begin
  v_expected_count := pg_catalog.cardinality(coalesce(p_image_ids, array[]::uuid[]));
  if v_expected_count = 0 then
    return;
  end if;

  if exists (
    select image_id
    from pg_catalog.unnest(p_image_ids) as image_id
    group by image_id
    having count(*) > 1
  ) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  perform file.id
  from public.media_files file
  where file.id = any(p_image_ids)
    and file.owner_user_id = p_user_id
    and file.purpose = 'editor-image'
    and file.status = 'ready'
    and (file.expires_at_ms is null or file.expires_at_ms > p_expires_after_ms)
    and file.resource_type is null
    and file.resource_id is null
  for update;

  get diagnostics v_valid_count = row_count;
  if v_valid_count <> v_expected_count then
    if exists (
      select 1 from public.media_files file
      where file.id = any(p_image_ids)
        and file.owner_user_id = p_user_id
        and file.purpose = 'editor-image'
        and file.status = 'ready'
        and file.resource_type is not null
    ) then
      raise exception 'EDITOR_IMAGE_ALREADY_ATTACHED' using errcode = '22023';
    end if;
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  update public.media_files file
  set resource_type = p_resource_type,
      resource_id = p_resource_id
  where file.id = any(p_image_ids);
end;
$function$;

create or replace function public.nexus_create_community_forum_topic(
  p_user_id uuid,
  p_topic_id uuid,
  p_community_id uuid,
  p_profile_id uuid,
  p_title text,
  p_content text,
  p_created_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  community_id uuid,
  profile_id uuid,
  title text,
  content text,
  created_at_ms bigint,
  updated_at_ms bigint,
  is_pinned boolean,
  is_locked boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plain_content text;
begin
  perform private.nexus_lock_collection_versions(
    array['community_forum_topics', 'communities', 'media_files', 'profiles']::text[]
  );

  if p_topic_id is null
     or p_community_id is null
     or p_profile_id is null
     or p_created_at_ms is null
     or p_title is null
     or pg_catalog.btrim(p_title) = ''
     or pg_catalog.char_length(p_title) > 140
     or p_content is null
     or pg_catalog.char_length(p_content) > 8000 then
    raise exception 'INVALID_FORUM_TOPIC' using errcode = '22023';
  end if;

  v_plain_content := pg_catalog.btrim(
    pg_catalog.regexp_replace(p_content, '<[^>]*>', '', 'g')
  );
  if v_plain_content = '' and p_content !~* '<img([[:space:]/>])' then
    raise exception 'INVALID_FORUM_TOPIC' using errcode = '22023';
  end if;

  perform private.nexus_forum_actor_role(
    p_user_id, p_community_id, p_profile_id, true, false
  );

  perform private.nexus_attach_forum_images(
    p_user_id, p_image_ids, p_created_at_ms, 'community-forum-topic', p_topic_id
  );

  insert into public.community_forum_topics (
    id, community_id, profile_id, title, content,
    created_at_ms, updated_at_ms, is_pinned, is_locked
  )
  values (
    p_topic_id, p_community_id, p_profile_id, pg_catalog.btrim(p_title), p_content,
    p_created_at_ms, p_created_at_ms, false, false
  );

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id = p_profile_id;

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(
    array['community_forum_topics', 'communities', 'media_files', 'profiles']::text[]
  );

  return query
  select topic.id, topic.community_id, topic.profile_id, topic.title, topic.content,
    topic.created_at_ms, topic.updated_at_ms, topic.is_pinned, topic.is_locked
  from public.community_forum_topics topic
  where topic.id = p_topic_id;
end;
$function$;

create or replace function public.nexus_create_community_forum_reply(
  p_user_id uuid,
  p_reply_id uuid,
  p_topic_id uuid,
  p_community_id uuid,
  p_profile_id uuid,
  p_content text,
  p_created_at_ms bigint,
  p_updated_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  topic_id uuid,
  community_id uuid,
  profile_id uuid,
  content text,
  created_at_ms bigint,
  updated_at_ms bigint
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_plain_content text;
  v_topic_id uuid;
  v_is_locked boolean;
begin
  perform private.nexus_lock_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );

  if p_reply_id is null
     or p_topic_id is null
     or p_community_id is null
     or p_profile_id is null
     or p_created_at_ms is null
     or p_updated_at_ms is null
     or p_content is null
     or pg_catalog.char_length(p_content) > 8000 then
    raise exception 'INVALID_FORUM_REPLY' using errcode = '22023';
  end if;

  v_plain_content := pg_catalog.btrim(
    pg_catalog.regexp_replace(p_content, '<[^>]*>', '', 'g')
  );
  if v_plain_content = '' and p_content !~* '<img([[:space:]/>])' then
    raise exception 'INVALID_FORUM_REPLY' using errcode = '22023';
  end if;

  perform private.nexus_forum_actor_role(
    p_user_id, p_community_id, p_profile_id, true, false
  );

  select topic.id, topic.is_locked
  into v_topic_id, v_is_locked
  from public.community_forum_topics topic
  where topic.id = p_topic_id
    and topic.community_id = p_community_id
  for update;

  if not found then
    raise exception 'FORUM_TOPIC_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_is_locked then
    raise exception 'FORUM_TOPIC_LOCKED' using errcode = '42501';
  end if;

  perform private.nexus_attach_forum_images(
    p_user_id, p_image_ids, p_created_at_ms, 'community-forum-reply', p_reply_id
  );

  insert into public.community_forum_replies (
    id, topic_id, community_id, profile_id, content, created_at_ms, updated_at_ms
  )
  values (
    p_reply_id, p_topic_id, p_community_id, p_profile_id,
    p_content, p_created_at_ms, p_updated_at_ms
  );

  update public.community_forum_topics
  set updated_at_ms = p_updated_at_ms
  where id = p_topic_id
    and community_id = p_community_id;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id = p_profile_id;

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(
    array[
      'community_forum_replies', 'community_forum_topics',
      'communities', 'media_files', 'profiles'
    ]::text[]
  );

  return query
  select reply.id, reply.topic_id, reply.community_id, reply.profile_id,
    reply.content, reply.created_at_ms, reply.updated_at_ms
  from public.community_forum_replies reply
  where reply.id = p_reply_id;
end;
$function$;

create or replace function public.nexus_moderate_community_forum_topic(
  p_user_id uuid,
  p_community_id uuid,
  p_topic_id uuid,
  p_actor_profile_id uuid,
  p_is_pinned boolean default null,
  p_is_locked boolean default null,
  p_updated_at_ms bigint default null
)
returns table (
  id uuid,
  community_id uuid,
  profile_id uuid,
  title text,
  content text,
  created_at_ms bigint,
  updated_at_ms bigint,
  is_pinned boolean,
  is_locked boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  perform private.nexus_lock_collection_versions(
    array['community_forum_topics', 'communities', 'profiles']::text[]
  );

  if p_updated_at_ms is null then
    raise exception 'INVALID_FORUM_TOPIC' using errcode = '22023';
  end if;

  perform private.nexus_forum_actor_role(
    p_user_id, p_community_id, p_actor_profile_id, false, true
  );

  update public.community_forum_topics topic
  set is_pinned = coalesce(p_is_pinned, topic.is_pinned),
      is_locked = coalesce(p_is_locked, topic.is_locked),
      updated_at_ms = p_updated_at_ms
  where topic.id = p_topic_id
    and topic.community_id = p_community_id;

  if not found then
    raise exception 'FORUM_TOPIC_NOT_FOUND' using errcode = 'P0002';
  end if;

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_actor_profile_id;

  update public.communities
  set last_activity_ms = greatest(last_activity_ms, p_updated_at_ms)
  where id = p_community_id;

  perform private.nexus_bump_collection_versions(
    array['community_forum_topics', 'communities', 'profiles']::text[]
  );

  return query
  select topic.id, topic.community_id, topic.profile_id, topic.title, topic.content,
    topic.created_at_ms, topic.updated_at_ms, topic.is_pinned, topic.is_locked
  from public.community_forum_topics topic
  where topic.id = p_topic_id
    and topic.community_id = p_community_id;
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

  update public.media_files file
  set resource_type = null, resource_id = null,
      message_from_profile_id = null, message_to_profile_id = null
  where (
    file.resource_type = 'community-forum-topic'
    and file.resource_id = p_topic_id
  ) or (
    file.resource_type = 'community-forum-reply'
    and file.resource_id in (
      select reply.id from public.community_forum_replies reply
      where reply.topic_id = p_topic_id
        and reply.community_id = p_community_id
    )
  );

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

  update public.media_files
  set resource_type = null,
      resource_id = null,
      message_from_profile_id = null,
      message_to_profile_id = null
  where resource_type = 'community-forum-reply'
    and resource_id = p_reply_id;

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

revoke all on function private.nexus_lock_collection_versions(text[]) from public, authenticated;
revoke all on function private.nexus_bump_collection_versions(text[]) from public, authenticated;
revoke all on function private.nexus_forum_actor_role(uuid, uuid, uuid, boolean, boolean) from public, authenticated;
revoke all on function private.nexus_attach_forum_images(uuid, uuid[], bigint, text, uuid) from public, authenticated;
grant execute on function private.nexus_lock_collection_versions(text[]) to anon;
grant execute on function private.nexus_bump_collection_versions(text[]) to anon;
grant execute on function private.nexus_forum_actor_role(uuid, uuid, uuid, boolean, boolean) to anon;
grant execute on function private.nexus_attach_forum_images(uuid, uuid[], bigint, text, uuid) to anon;

revoke all on function public.nexus_create_community_forum_topic(uuid, uuid, uuid, uuid, text, text, bigint, uuid[]) from public, authenticated;
revoke all on function public.nexus_create_community_forum_reply(uuid, uuid, uuid, uuid, uuid, text, bigint, bigint, uuid[]) from public, authenticated;
revoke all on function public.nexus_moderate_community_forum_topic(uuid, uuid, uuid, uuid, boolean, boolean, bigint) from public, authenticated;
revoke all on function public.nexus_delete_community_forum_topic(uuid, uuid, uuid, uuid, bigint) from public, authenticated;
revoke all on function public.nexus_delete_community_forum_reply(uuid, uuid, uuid, uuid, bigint) from public, authenticated;
grant execute on function public.nexus_create_community_forum_topic(uuid, uuid, uuid, uuid, text, text, bigint, uuid[]) to anon;
grant execute on function public.nexus_create_community_forum_reply(uuid, uuid, uuid, uuid, uuid, text, bigint, bigint, uuid[]) to anon;
grant execute on function public.nexus_moderate_community_forum_topic(uuid, uuid, uuid, uuid, boolean, boolean, bigint) to anon;
grant execute on function public.nexus_delete_community_forum_topic(uuid, uuid, uuid, uuid, bigint) to anon;
grant execute on function public.nexus_delete_community_forum_reply(uuid, uuid, uuid, uuid, bigint) to anon;

notify pgrst, 'reload schema';
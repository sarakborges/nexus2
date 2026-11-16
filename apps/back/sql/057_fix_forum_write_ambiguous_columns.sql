-- PL/pgSQL exposes RETURNS TABLE columns as variables. Qualify every
-- updated target column so the output column names cannot shadow table fields.

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

  update public.profiles as profile_row
  set last_activity_ms = greatest(profile_row.last_activity_ms, p_created_at_ms)
  where profile_row.id = p_profile_id;

  update public.communities as community_row
  set last_activity_ms = greatest(community_row.last_activity_ms, p_created_at_ms)
  where community_row.id = p_community_id;

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

  update public.community_forum_topics as topic_row
  set updated_at_ms = p_updated_at_ms
  where topic_row.id = p_topic_id
    and topic_row.community_id = p_community_id;

  update public.profiles as profile_row
  set last_activity_ms = greatest(profile_row.last_activity_ms, p_created_at_ms)
  where profile_row.id = p_profile_id;

  update public.communities as community_row
  set last_activity_ms = greatest(community_row.last_activity_ms, p_created_at_ms)
  where community_row.id = p_community_id;

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

  update public.profiles as profile_row
  set last_activity_ms = greatest(profile_row.last_activity_ms, p_updated_at_ms)
  where profile_row.id = p_actor_profile_id;

  update public.communities as community_row
  set last_activity_ms = greatest(community_row.last_activity_ms, p_updated_at_ms)
  where community_row.id = p_community_id;

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

notify pgrst, 'reload schema';

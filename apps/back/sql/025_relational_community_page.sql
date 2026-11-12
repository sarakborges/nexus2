create or replace function public.nexus_get_community_page(
  p_url text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  c public.communities%rowtype;
  a public.accounts%rowtype;
  owner_type text;
  owned uuid[] := array[]::uuid[];
  current_id uuid;
  current_type text;
  viewer_relationship jsonb;
  viewer_relationships jsonb := '[]'::jsonb;
  view_members boolean := false;
  edit_community boolean := false;
  has_staff boolean := false;
  pending_count bigint := 0;
  member_count bigint := 0;
  topic_count bigint := 0;
  topic_pages integer := 1;
  members_json jsonb := '[]'::jsonb;
  topics_json jsonb := '[]'::jsonb;
  authors_json jsonb := '[]'::jsonb;
  author_ids uuid[] := array[]::uuid[];
  community_json jsonb;
begin
  if p_url is null or pg_catalog.btrim(p_url) = '' then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_user_id is not null then
    select * into a from public.accounts where id = p_user_id;
    if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002'; end if;
    select coalesce(array_agg(profile_id order by position), array[]::uuid[])
    into owned from public.account_profiles where account_id = p_user_id;
    if a.current_profile_id = any(owned) then
      current_id := a.current_profile_id;
      select type into current_type from public.profiles where id = current_id;
    end if;
  end if;

  select * into c from public.communities where url = p_url limit 1;
  if not found then
    return jsonb_build_object(
      'community', null, 'relationships', '[]'::jsonb,
      'viewerRelationship', null, 'currentProfileType', null,
      'canViewMembers', false, 'canEditCommunity', false, 'pendingRequestCount', 0,
      'members', jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1),
      'forumTopics', jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1),
      'forumAuthors', '[]'::jsonb
    );
  end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms, r.profile_id limit 1;
  if found then c.type := owner_type; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'profiles', jsonb_build_array(r.profile_id, r.community_id),
    'type', r.type, 'requestedBy', r.requested_by,
    'blockedBy', r.blocked_by, 'updatedAt', r.updated_at_ms
  ) order by r.profile_id), '[]'::jsonb)
  into viewer_relationships
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id
    and r.profile_id = any(owned)
    and p.type = c.type;

  if current_id is not null then
    select jsonb_build_object(
      'profiles', jsonb_build_array(r.profile_id, r.community_id),
      'type', r.type, 'requestedBy', r.requested_by,
      'blockedBy', r.blocked_by, 'updatedAt', r.updated_at_ms
    )
    into viewer_relationship
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.profile_id = current_id and p.type = c.type
    limit 1;
  end if;

  view_members := c.privacy <> 'private' or exists (
    select 1
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = any(owned)
      and p.type = c.type
      and r.type in ('owner','moderator','connection')
  );
  edit_community := exists (
    select 1
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.profile_id = any(owned)
      and p.type = c.type and r.type = 'owner'
  );
  has_staff := exists (
    select 1
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.profile_id = any(owned)
      and p.type = c.type and r.type in ('owner','moderator')
  );

  if has_staff then
    select count(*)::bigint
    into pending_count
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.type = 'requested' and p.type = c.type;
  end if;

  select count(*)::bigint
  into member_count
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id
    and r.type in ('owner','moderator','connection')
    and p.type = c.type;

  if view_members then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', page_rows.id, 'name', page_rows.name, 'url', page_rows.url,
      'picture', page_rows.picture, 'about', page_rows.about, 'type', page_rows.type,
      'createdAt', page_rows.created_at_ms, 'lastActivity', page_rows.last_activity_ms
    ) order by page_rows.id), '[]'::jsonb)
    into members_json
    from (
      select p.*
      from public.community_relationships r
      join public.profiles p on p.id = r.profile_id
      where r.community_id = c.id
        and r.type in ('owner','moderator','connection')
        and p.type = c.type
      order by p.id
      limit 20
    ) page_rows;
  else
    member_count := 0;
  end if;

  if view_members then
    select count(*)::bigint into topic_count
    from public.community_forum_topics t where t.community_id = c.id;
    topic_pages := greatest(1, ceil(topic_count::numeric / 20)::integer);

    select
      coalesce(array_agg(page_rows.profile_id), array[]::uuid[]),
      coalesce(jsonb_agg(jsonb_build_object(
        'id', page_rows.id, 'communityId', page_rows.community_id,
        'profileId', page_rows.profile_id, 'title', page_rows.title,
        'content', page_rows.content, 'createdAt', page_rows.created_at_ms,
        'updatedAt', page_rows.updated_at_ms, 'isPinned', page_rows.is_pinned,
        'isLocked', page_rows.is_locked, 'replyCount', page_rows.reply_count
      ) order by page_rows.is_pinned desc, page_rows.updated_at_ms desc, page_rows.id), '[]'::jsonb)
    into author_ids, topics_json
    from (
      select t.*,
        (select count(*)::integer from public.community_forum_replies r
         where r.topic_id = t.id and r.community_id = c.id) reply_count
      from public.community_forum_topics t
      where t.community_id = c.id
      order by t.is_pinned desc, t.updated_at_ms desc, t.id
      limit 20
    ) page_rows;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'url', p.url, 'picture', p.picture,
      'about', p.about, 'type', p.type, 'createdAt', p.created_at_ms,
      'lastActivity', p.last_activity_ms
    ) order by p.id), '[]'::jsonb)
    into authors_json
    from public.profiles p where p.id = any(author_ids);
  else
    topic_count := 0;
    topics_json := '[]'::jsonb;
    authors_json := '[]'::jsonb;
    topic_pages := 1;
  end if;

  community_json := jsonb_build_object(
    'id', c.id, 'name', c.name, 'url', c.url,
    'picture', case when c.privacy = 'private' and not view_members then '' else c.picture end,
    'about', case when c.privacy = 'private' and not view_members then '' else c.about end,
    'type', c.type, 'privacy', c.privacy,
    'createdAt', c.created_at_ms, 'lastActivity', c.last_activity_ms
  );

  return jsonb_build_object(
    'community', community_json,
    'relationships', viewer_relationships,
    'viewerRelationship', viewer_relationship,
    'currentProfileType', current_type,
    'canViewMembers', view_members,
    'canEditCommunity', edit_community,
    'pendingRequestCount', pending_count,
    'members', jsonb_build_object(
      'items', members_json, 'page', 1, 'pageSize', 20,
      'totalItems', member_count,
      'totalPages', greatest(1, ceil(member_count::numeric / 20)::integer)
    ),
    'forumTopics', jsonb_build_object(
      'items', topics_json, 'page', 1, 'pageSize', 20,
      'totalItems', topic_count, 'totalPages', topic_pages
    ),
    'forumAuthors', authors_json
  );
end;
$function$;

revoke all on function public.nexus_get_community_page(text,uuid) from public, authenticated;
grant execute on function public.nexus_get_community_page(text,uuid) to anon;
notify pgrst, 'reload schema';
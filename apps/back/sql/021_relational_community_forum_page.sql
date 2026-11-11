create or replace function private.nexus_forum_search_text(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select pg_catalog.lower(
    pg_catalog.btrim(
      pg_catalog.regexp_replace(
        pg_catalog.replace(
          pg_catalog.replace(
            pg_catalog.replace(
              pg_catalog.replace(
                pg_catalog.regexp_replace(coalesce(p_value, ''), '<[^>]*>', ' ', 'g'),
                '&nbsp;', ' '
              ),
              '&#160;', ' '
            ),
            '&amp;', '&'
          ),
          '&lt;', '<'
        ),
        '[[:space:]]+', ' ', 'g'
      )
    )
  );
$function$;

create or replace function public.nexus_get_community_forum_page(
  p_url text,
  p_user_id uuid default null,
  p_page integer default 1,
  p_query text default null,
  p_sort text default 'activity-desc'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_community public.communities%rowtype;
  v_account public.accounts%rowtype;
  v_owner_type text;
  v_owned_profile_ids uuid[] := array[]::uuid[];
  v_current_profile_id uuid;
  v_current_profile_type text;
  v_viewer_relationship jsonb;
  v_can_read boolean := false;
  v_can_publish boolean := false;
  v_visible_community jsonb;
  v_total_items bigint := 0;
  v_total_pages integer := 1;
  v_page integer := 1;
  v_topics jsonb := '[]'::jsonb;
  v_authors jsonb := '[]'::jsonb;
  v_author_ids uuid[] := array[]::uuid[];
  v_search text := private.nexus_forum_search_text(p_query);
  v_sort text := coalesce(p_sort, 'activity-desc');
begin
  if p_url is null or pg_catalog.btrim(p_url) = '' then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sort not in ('activity-desc', 'activity-asc', 'name-asc', 'name-desc') then
    v_sort := 'activity-desc';
  end if;

  select community.*
  into v_community
  from public.communities community
  where community.url = p_url
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object(
      'community', null,
      'viewerRelationship', null,
      'currentProfileType', null,
      'canReadForum', false,
      'canPublish', false,
      'topics', pg_catalog.jsonb_build_object(
        'items', '[]'::jsonb, 'page', 1, 'pageSize', 20,
        'totalItems', 0, 'totalPages', 1
      ),
      'authors', '[]'::jsonb
    );
  end if;

  select owner_profile.type
  into v_owner_type
  from public.community_relationships owner_relationship
  join public.profiles owner_profile
    on owner_profile.id = owner_relationship.profile_id
  where owner_relationship.community_id = v_community.id
    and owner_relationship.type = 'owner'
  order by owner_relationship.updated_at_ms asc, owner_relationship.profile_id asc
  limit 1;

  if found then
    v_community.type := v_owner_type;
  end if;

  if p_user_id is not null then
    select account.*
    into v_account
    from public.accounts account
    where account.id = p_user_id;

    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(
      pg_catalog.array_agg(membership.profile_id order by membership.position),
      array[]::uuid[]
    )
    into v_owned_profile_ids
    from public.account_profiles membership
    where membership.account_id = p_user_id;

    if v_account.current_profile_id = any(v_owned_profile_ids) then
      v_current_profile_id := v_account.current_profile_id;
      select profile.type
      into v_current_profile_type
      from public.profiles profile
      where profile.id = v_current_profile_id;
    end if;

    select pg_catalog.jsonb_build_object(
      'profiles', pg_catalog.jsonb_build_array(relationship.profile_id, relationship.community_id),
      'type', relationship.type,
      'requestedBy', relationship.requested_by,
      'blockedBy', relationship.blocked_by,
      'updatedAt', relationship.updated_at_ms
    )
    into v_viewer_relationship
    from public.community_relationships relationship
    join public.profiles actor_profile
      on actor_profile.id = relationship.profile_id
    where relationship.community_id = v_community.id
      and relationship.profile_id = v_current_profile_id
      and actor_profile.type = v_community.type
    limit 1;

    select exists (
      select 1
      from public.community_relationships relationship
      join public.profiles actor_profile
        on actor_profile.id = relationship.profile_id
      where relationship.community_id = v_community.id
        and relationship.profile_id = any(v_owned_profile_ids)
        and actor_profile.type = v_community.type
        and relationship.type in ('owner', 'moderator', 'connection')
    )
    into v_can_publish;

    v_can_read := v_community.privacy <> 'private' or exists (
      select 1
      from public.community_relationships relationship
      where relationship.community_id = v_community.id
        and relationship.profile_id = any(v_owned_profile_ids)
        and relationship.type in ('owner', 'moderator', 'connection')
    );
  else
    v_can_read := v_community.privacy <> 'private';
  end if;

  v_visible_community := pg_catalog.jsonb_build_object(
    'id', v_community.id,
    'name', v_community.name,
    'url', v_community.url,
    'picture', case when v_community.privacy = 'private' and not v_can_read then '' else v_community.picture end,
    'about', case when v_community.privacy = 'private' and not v_can_read then '' else v_community.about end,
    'type', v_community.type,
    'privacy', v_community.privacy,
    'createdAt', v_community.created_at_ms,
    'lastActivity', v_community.last_activity_ms
  );

  if v_can_read then
    select count(*)::bigint
    into v_total_items
    from public.community_forum_topics topic
    where topic.community_id = v_community.id
      and (
        v_search = ''
        or pg_catalog.strpos(private.nexus_forum_search_text(topic.title || ' ' || topic.content), v_search) > 0
      );

    v_total_pages := greatest(1, pg_catalog.ceil(v_total_items::numeric / 20)::integer);
    v_page := least(greatest(coalesce(p_page, 1), 1), v_total_pages);

    select
      coalesce(pg_catalog.array_agg(page_rows.profile_id), array[]::uuid[]),
      coalesce(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', page_rows.id,
            'communityId', page_rows.community_id,
            'profileId', page_rows.profile_id,
            'title', page_rows.title,
            'content', page_rows.content,
            'createdAt', page_rows.created_at_ms,
            'updatedAt', page_rows.updated_at_ms,
            'isPinned', page_rows.is_pinned,
            'isLocked', page_rows.is_locked,
            'replyCount', page_rows.reply_count
          )
          order by
            page_rows.is_pinned desc,
            case when v_sort = 'activity-asc' then coalesce(nullif(page_rows.updated_at_ms, 0), page_rows.created_at_ms) end asc,
            case when v_sort = 'activity-desc' then coalesce(nullif(page_rows.updated_at_ms, 0), page_rows.created_at_ms) end desc,
            case when v_sort = 'name-asc' then pg_catalog.lower(page_rows.title) end asc,
            case when v_sort = 'name-desc' then pg_catalog.lower(page_rows.title) end desc,
            page_rows.id asc
        ),
        '[]'::jsonb
      )
    into v_author_ids, v_topics
    from (
      select
        topic.*,
        (
          select count(*)::integer
          from public.community_forum_replies reply
          where reply.topic_id = topic.id
            and reply.community_id = topic.community_id
        ) as reply_count
      from public.community_forum_topics topic
      where topic.community_id = v_community.id
        and (
          v_search = ''
          or pg_catalog.strpos(private.nexus_forum_search_text(topic.title || ' ' || topic.content), v_search) > 0
        )
      order by
        topic.is_pinned desc,
        case when v_sort = 'activity-asc' then coalesce(nullif(topic.updated_at_ms, 0), topic.created_at_ms) end asc,
        case when v_sort = 'activity-desc' then coalesce(nullif(topic.updated_at_ms, 0), topic.created_at_ms) end desc,
        case when v_sort = 'name-asc' then pg_catalog.lower(topic.title) end asc,
        case when v_sort = 'name-desc' then pg_catalog.lower(topic.title) end desc,
        topic.id asc
      offset ((v_page - 1) * 20)
      limit 20
    ) page_rows;

    select coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', profile.id,
          'name', profile.name,
          'url', profile.url,
          'picture', profile.picture,
          'about', profile.about,
          'type', profile.type,
          'createdAt', profile.created_at_ms,
          'lastActivity', profile.last_activity_ms
        )
        order by profile.id
      ),
      '[]'::jsonb
    )
    into v_authors
    from public.profiles profile
    where profile.id = any(v_author_ids);
  end if;

  return pg_catalog.jsonb_build_object(
    'community', v_visible_community,
    'viewerRelationship', v_viewer_relationship,
    'currentProfileType', v_current_profile_type,
    'canReadForum', v_can_read,
    'canPublish', v_can_publish,
    'topics', pg_catalog.jsonb_build_object(
      'items', v_topics,
      'page', v_page,
      'pageSize', 20,
      'totalItems', v_total_items,
      'totalPages', v_total_pages
    ),
    'authors', v_authors
  );
end;
$function$;

revoke all on function private.nexus_forum_search_text(text) from public, authenticated;
grant execute on function private.nexus_forum_search_text(text) to anon;
revoke all on function public.nexus_get_community_forum_page(text, uuid, integer, text, text) from public, authenticated;
grant execute on function public.nexus_get_community_forum_page(text, uuid, integer, text, text) to anon;

notify pgrst, 'reload schema';
-- Require a membership profile to match the community's effective type
-- before it can authorize reads of private community/forum data.
begin;

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
      join public.profiles member_profile
        on member_profile.id = relationship.profile_id
      where relationship.community_id = v_community.id
        and relationship.profile_id = any(v_owned_profile_ids)
        and member_profile.type = v_community.type
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

create or replace function public.nexus_get_community_forum_topic_page(
  p_url text, p_topic_id uuid, p_user_id uuid default null,
  p_page integer default 1, p_query text default null, p_sort text default 'activity-asc'
)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  c public.communities%rowtype;
  a public.accounts%rowtype;
  t public.community_forum_topics%rowtype;
  owner_type text;
  owned uuid[] := array[]::uuid[];
  current_id uuid;
  current_type text;
  viewer_relation jsonb;
  forum_profile uuid;
  forum_role text;
  member boolean := false;
  staff boolean := false;
  search_text text := private.nexus_forum_search_text(p_query);
  sort_order text := coalesce(p_sort, 'activity-asc');
  total bigint := 0;
  total_pages integer := 1;
  page_number integer := 1;
  replies_json jsonb := '[]'::jsonb;
  reply_authors uuid[] := array[]::uuid[];
  author_ids uuid[] := array[]::uuid[];
  authors_json jsonb := '[]'::jsonb;
  community_json jsonb;
begin
  if p_url is null or pg_catalog.btrim(p_url) = '' or p_topic_id is null then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;
  if sort_order not in ('activity-desc','activity-asc','name-asc','name-desc') then
    sort_order := 'activity-asc';
  end if;

  select * into c from public.communities where url = p_url limit 1;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms, r.profile_id limit 1;
  if found then c.type := owner_type; end if;

  if p_user_id is not null then
    select * into a from public.accounts where id = p_user_id;
    if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002'; end if;

    select coalesce(array_agg(profile_id order by position), array[]::uuid[])
    into owned from public.account_profiles where account_id = p_user_id;

    if a.current_profile_id = any(owned) then
      current_id := a.current_profile_id;
      select type into current_type from public.profiles where id = current_id;
    end if;

    select jsonb_build_object(
      'profiles', jsonb_build_array(r.profile_id, r.community_id),
      'type', r.type, 'requestedBy', r.requested_by,
      'blockedBy', r.blocked_by, 'updatedAt', r.updated_at_ms
    )
    into viewer_relation
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.profile_id = current_id and p.type = c.type
    limit 1;

    select r.profile_id, r.type into forum_profile, forum_role
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    join public.community_relationships r
      on r.profile_id = ap.profile_id and r.community_id = c.id
    where ap.account_id = p_user_id
      and p.type = c.type
      and r.type in ('owner','moderator','connection')
    order by (ap.profile_id = current_id) desc,
      case r.type when 'owner' then 0 when 'moderator' then 1 else 2 end,
      ap.position
    limit 1;
    member := found;
    staff := coalesce(forum_role in ('owner','moderator'), false);
  end if;

  if c.privacy = 'private' and not exists (
    select 1
    from public.community_relationships r
    join public.profiles member_profile on member_profile.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = any(owned)
      and member_profile.type = c.type
      and r.type in ('owner','moderator','connection')
  ) then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into t from public.community_forum_topics
  where id = p_topic_id and community_id = c.id limit 1;
  if not found then raise exception 'FORUM_TOPIC_NOT_FOUND' using errcode = 'P0002'; end if;

  select count(*)::bigint into total
  from public.community_forum_replies r
  left join public.profiles p on p.id = r.profile_id
  where r.topic_id = t.id and r.community_id = c.id
    and (search_text = '' or strpos(
      private.nexus_forum_search_text(r.content || ' ' || coalesce(p.name,'') || ' ' || coalesce(p.url,'')),
      search_text
    ) > 0);

  total_pages := greatest(1, ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1), total_pages);

  select
    coalesce(array_agg(q.profile_id), array[]::uuid[]),
    coalesce(jsonb_agg(jsonb_build_object(
      'id', q.id, 'topicId', q.topic_id, 'communityId', q.community_id,
      'profileId', q.profile_id, 'content', q.content,
      'createdAt', q.created_at_ms, 'updatedAt', q.updated_at_ms
    ) order by
      case when sort_order = 'activity-asc' then q.created_at_ms end asc,
      case when sort_order = 'activity-desc' then q.created_at_ms end desc,
      case when sort_order = 'name-asc' then lower(q.author_name) end asc,
      case when sort_order = 'name-desc' then lower(q.author_name) end desc,
      q.id
    ), '[]'::jsonb)
  into reply_authors, replies_json
  from (
    select r.*, coalesce(p.name,'') author_name
    from public.community_forum_replies r
    left join public.profiles p on p.id = r.profile_id
    where r.topic_id = t.id and r.community_id = c.id
      and (search_text = '' or strpos(
        private.nexus_forum_search_text(r.content || ' ' || coalesce(p.name,'') || ' ' || coalesce(p.url,'')),
        search_text
      ) > 0)
    order by
      case when sort_order = 'activity-asc' then r.created_at_ms end asc,
      case when sort_order = 'activity-desc' then r.created_at_ms end desc,
      case when sort_order = 'name-asc' then lower(coalesce(p.name,'')) end asc,
      case when sort_order = 'name-desc' then lower(coalesce(p.name,'')) end desc,
      r.id
    offset ((page_number - 1) * 20) limit 20
  ) q;

  author_ids := reply_authors || array[t.profile_id];
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.name,'url',p.url,'picture',p.picture,'about',p.about,
    'type',p.type,'createdAt',p.created_at_ms,'lastActivity',p.last_activity_ms
  ) order by p.id), '[]'::jsonb)
  into authors_json
  from public.profiles p where p.id = any(author_ids);

  community_json := jsonb_build_object(
    'id',c.id,'name',c.name,'url',c.url,'picture',c.picture,'about',c.about,
    'type',c.type,'privacy',c.privacy,'createdAt',c.created_at_ms,'lastActivity',c.last_activity_ms
  );

  return jsonb_build_object(
    'community', community_json,
    'detail', jsonb_build_object(
      'topic', jsonb_build_object(
        'id',t.id,'communityId',t.community_id,'profileId',t.profile_id,
        'title',t.title,'content',t.content,'createdAt',t.created_at_ms,
        'updatedAt',t.updated_at_ms,'isPinned',t.is_pinned,'isLocked',t.is_locked,
        'replyCount',total
      ),
      'replies', jsonb_build_object(
        'items',replies_json,'page',page_number,'pageSize',20,
        'totalItems',total,'totalPages',total_pages
      )
    ),
    'forumProfileId',forum_profile,
    'viewerRelationship',viewer_relation,
    'currentProfileType',current_type,
    'isMember',member,
    'isStaff',staff,
    'authors',authors_json
  );
end;
$function$;

create or replace function public.nexus_get_community_members_page(
  p_url text,
  p_user_id uuid default null,
  p_page integer default 1,
  p_pending_page integer default 1,
  p_query text default null,
  p_sort text default 'activity-desc',
  p_tab text default 'all'
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
  actor_profile uuid;
  actor_role text;
  is_staff boolean := false;
  visible_tab text := 'all';
  member_roles text[] := array['owner','moderator','connection']::text[];
  pending_count bigint := 0;
  member_count bigint := 0;
  pending_total bigint := 0;
  member_pages integer := 1;
  pending_pages integer := 1;
  member_page integer := 1;
  pending_page_number integer := 1;
  search_text text := private.nexus_forum_search_text(p_query);
  sort_order text := coalesce(p_sort, 'activity-desc');
  members_json jsonb := '[]'::jsonb;
  pending_json jsonb := '[]'::jsonb;
  community_json jsonb;
begin
  if p_url is null or pg_catalog.btrim(p_url) = '' then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if sort_order not in ('activity-desc','activity-asc','name-asc','name-desc') then
    sort_order := 'activity-desc';
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
      'community',null,'relationships','[]'::jsonb,'viewerRelationship',null,
      'currentProfileType',null,'actorProfileId',null,'actorRole',null,
      'isStaff',false,'visibleTab','all',
      'members',jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1),
      'pending',jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1)
    );
  end if;

  select profile.type into owner_type
  from public.community_relationships owner_relation
  join public.profiles profile on profile.id = owner_relation.profile_id
  where owner_relation.community_id = c.id and owner_relation.type = 'owner'
  order by owner_relation.updated_at_ms desc, owner_relation.profile_id
  limit 1;
  if found then c.type := owner_type; end if;

  if c.privacy = 'private' and not exists (
    select 1
    from public.community_relationships r
    join public.profiles member_profile on member_profile.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = any(owned)
      and member_profile.type = c.type
      and r.type in ('owner','moderator','connection')
  ) then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'profiles',jsonb_build_array(r.profile_id,r.community_id),
    'type',r.type,'requestedBy',r.requested_by,'blockedBy',r.blocked_by,
    'updatedAt',r.updated_at_ms
  ) order by r.updated_at_ms desc, r.profile_id), '[]'::jsonb)
  into viewer_relationships
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id
    and r.profile_id = any(owned)
    and p.type = c.type;

  if current_id is not null then
    select jsonb_build_object(
      'profiles',jsonb_build_array(r.profile_id,r.community_id),
      'type',r.type,'requestedBy',r.requested_by,'blockedBy',r.blocked_by,
      'updatedAt',r.updated_at_ms
    )
    into viewer_relationship
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = current_id
      and p.type = c.type
    limit 1;
  end if;

  if current_id is null or current_type = c.type then
    select r.profile_id, r.type
    into actor_profile, actor_role
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    join public.account_profiles ap on ap.profile_id = r.profile_id and ap.account_id = p_user_id
    where r.community_id = c.id
      and p.type = c.type
      and r.type in ('owner','moderator')
    order by r.updated_at_ms desc, ap.position, r.profile_id
    limit 1;
    is_staff := found;
  end if;

  if is_staff then
    visible_tab := case when p_tab in ('staff','banned') then p_tab else 'all' end;
    if visible_tab = 'staff' then
      member_roles := array['owner','moderator']::text[];
    elsif visible_tab = 'banned' then
      member_roles := array['blocked']::text[];
    else
      member_roles := array['owner','moderator','connection']::text[];
    end if;
  else
    visible_tab := 'all';
    member_roles := array['owner','moderator','connection']::text[];
  end if;

  select count(*)::bigint
  into member_count
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id
    and r.type = any(member_roles)
    and p.type = c.type
    and (
      search_text = ''
      or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url), search_text) > 0
    );

  member_pages := greatest(1, ceil(member_count::numeric / 20)::integer);
  member_page := least(greatest(coalesce(p_page,1),1), member_pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms,'role',q.role
  ) order by
    case when sort_order = 'activity-asc' then q.activity_value end asc,
    case when sort_order = 'activity-desc' then q.activity_value end desc,
    case when sort_order = 'name-asc' then lower(q.name) end asc,
    case when sort_order = 'name-desc' then lower(q.name) end desc,
    q.id
  ),'[]'::jsonb)
  into members_json
  from (
    select p.*, r.type as role,
      coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) as activity_value
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.type = any(member_roles)
      and p.type = c.type
      and (
        search_text = ''
        or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url), search_text) > 0
      )
    order by
      case when sort_order = 'activity-asc' then coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) end asc,
      case when sort_order = 'activity-desc' then coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) end desc,
      case when sort_order = 'name-asc' then lower(p.name) end asc,
      case when sort_order = 'name-desc' then lower(p.name) end desc,
      p.id
    offset ((member_page - 1) * 20)
    limit 20
  ) q;

  if is_staff then
    select count(*)::bigint
    into pending_total
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.type = 'requested'
      and p.type = c.type
      and (
        search_text = ''
        or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url), search_text) > 0
      );
  end if;

  pending_pages := greatest(1, ceil(pending_total::numeric / 20)::integer);
  pending_page_number := least(greatest(coalesce(p_pending_page,1),1),pending_pages);

  if is_staff then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
      'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
      'lastActivity',q.last_activity_ms,'role','requested'
    ) order by
      case when sort_order = 'activity-asc' then q.activity_value end asc,
      case when sort_order = 'activity-desc' then q.activity_value end desc,
      case when sort_order = 'name-asc' then lower(q.name) end asc,
      case when sort_order = 'name-desc' then lower(q.name) end desc,
      q.id
    ),'[]'::jsonb)
    into pending_json
    from (
      select p.*, coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) as activity_value
      from public.community_relationships r
      join public.profiles p on p.id = r.profile_id
      where r.community_id = c.id
        and r.type = 'requested'
        and p.type = c.type
        and (
          search_text = ''
          or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url), search_text) > 0
        )
      order by
        case when sort_order = 'activity-asc' then coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) end asc,
        case when sort_order = 'activity-desc' then coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) end desc,
        case when sort_order = 'name-asc' then lower(p.name) end asc,
        case when sort_order = 'name-desc' then lower(p.name) end desc,
        p.id
      offset ((pending_page_number - 1) * 20)
      limit 20
    ) q;
  end if;

  return jsonb_build_object(
    'community',jsonb_build_object(
      'id',c.id,'name',c.name,'url',c.url,'picture',c.picture,
      'about',c.about,'type',c.type,'privacy',c.privacy,
      'createdAt',c.created_at_ms,'lastActivity',c.last_activity_ms
    ),
    'relationships',viewer_relationships,
    'viewerRelationship',viewer_relationship,
    'currentProfileType',current_type,
    'actorProfileId',actor_profile,
    'actorRole',actor_role,
    'isStaff',is_staff,
    'visibleTab',visible_tab,
    'members',jsonb_build_object(
      'items',members_json,'page',member_page,'pageSize',20,
      'totalItems',member_count,'totalPages',member_pages
    ),
    'pending',jsonb_build_object(
      'items',pending_json,'page',pending_page_number,'pageSize',20,
      'totalItems',pending_total,'totalPages',pending_pages
    )
  );
end;
$function$;

create or replace function public.nexus_list_community_members(
  p_community_id uuid,
  p_tab text default 'all',
  p_user_id uuid default null,
  p_actor_profile_id uuid default null,
  p_page integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  c public.communities%rowtype;
  owner_type text;
  owned uuid[] := array[]::uuid[];
  actor_role text;
  actor_type text;
  member_roles text[] := array['owner','moderator','connection']::text[];
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  select * into c from public.communities where id = p_community_id;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_tab not in ('all','staff','banned') then raise exception 'INVALID_MEMBER_TAB' using errcode = '22023'; end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms,r.profile_id limit 1;
  if found then c.type := owner_type; end if;

  if p_user_id is not null then
    if not exists(select 1 from public.accounts where id = p_user_id) then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(profile_id order by position),array[]::uuid[])
    into owned from public.account_profiles where account_id = p_user_id;
  end if;

  if c.privacy = 'private' and not exists (
    select 1
    from public.community_relationships r
    join public.profiles member_profile on member_profile.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = any(owned)
      and member_profile.type = c.type
      and r.type in ('owner','moderator','connection')
  ) then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_tab <> 'all' then
    if p_user_id is null or p_actor_profile_id is null then
      raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode = '42501';
    end if;
    if not (p_actor_profile_id = any(owned)) then
      raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
    end if;
    select p.type into actor_type
    from public.profiles p
    where p.id = p_actor_profile_id;
    if not found then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
    end if;
    if actor_type <> c.type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
    select r.type into actor_role
    from public.community_relationships r
    where r.community_id = c.id and r.profile_id = p_actor_profile_id;
    if coalesce(actor_role,'') not in ('owner','moderator') then
      raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode = '42501';
    end if;
  end if;

  if p_tab = 'staff' then
    member_roles := array['owner','moderator']::text[];
  elsif p_tab = 'banned' then
    member_roles := array['blocked']::text[];
  end if;

  select count(*)::bigint into total
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id
    and r.type = any(member_roles)
    and p.type = c.type;

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms,'role',q.role
  ) order by q.id),'[]'::jsonb)
  into items
  from (
    select p.*,r.type as role
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.type = any(member_roles)
      and p.type = c.type
    order by p.id
    offset ((page_number - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'items',items,'page',page_number,'pageSize',20,
    'totalItems',total,'totalPages',pages
  );
end;
$function$;

notify pgrst, 'reload schema';
commit;

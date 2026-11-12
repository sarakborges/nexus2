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
    select 1 from public.community_relationships r
    where r.community_id = c.id and r.profile_id = any(owned)
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

revoke all on function public.nexus_get_community_forum_topic_page(text,uuid,uuid,integer,text,text) from public, authenticated;
grant execute on function public.nexus_get_community_forum_topic_page(text,uuid,uuid,integer,text,text) to anon;
notify pgrst, 'reload schema';
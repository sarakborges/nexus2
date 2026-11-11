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
    select 1 from public.community_relationships r
    where r.community_id = c.id and r.profile_id = any(owned)
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

revoke all on function public.nexus_get_community_members_page(text,uuid,integer,integer,text,text,text) from public,authenticated;
grant execute on function public.nexus_get_community_members_page(text,uuid,integer,integer,text,text,text) to anon;
notify pgrst,'reload schema';
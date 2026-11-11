create or replace function public.nexus_get_owned_profiles(
  p_user_id uuid,
  p_page integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  if not exists(select 1 from public.accounts where id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*)::bigint into total
  from public.account_profiles where account_id = p_user_id;

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms
  ) order by q.position),'[]'::jsonb)
  into items
  from (
    select p.*,ap.position
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    where ap.account_id = p_user_id
    order by ap.position
    offset ((page_number - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'items',items,'page',page_number,'pageSize',20,
    'totalItems',total,'totalPages',pages
  );
end;
$function$;

create or replace function public.nexus_get_community_by_url(
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
  owner_type text;
  owned uuid[] := array[]::uuid[];
  is_member boolean := false;
begin
  select * into c from public.communities where url = p_url limit 1;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms,r.profile_id limit 1;
  if found then c.type := owner_type; end if;

  if c.privacy = 'private' and p_user_id is not null then
    if not exists(select 1 from public.accounts where id = p_user_id) then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(profile_id),array[]::uuid[])
    into owned from public.account_profiles where account_id = p_user_id;
  end if;

  if c.privacy = 'private' then
    select exists (
      select 1 from public.community_relationships r
      where r.community_id = c.id and r.profile_id = any(owned)
        and r.type in ('owner','moderator','connection')
    ) into is_member;
  else
    is_member := true;
  end if;

  return jsonb_build_object(
    'id',c.id,'name',c.name,'url',c.url,
    'picture',case when not is_member then '' else c.picture end,
    'about',case when not is_member then '' else c.about end,
    'type',c.type,'privacy',c.privacy,
    'createdAt',c.created_at_ms,'lastActivity',c.last_activity_ms
  );
end;
$function$;

create or replace function public.nexus_get_profile_communities(
  p_profile_id uuid,
  p_page integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  source_profile public.profiles%rowtype;
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  select * into source_profile from public.profiles where id = p_profile_id;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  select count(*)::bigint into total
  from public.community_relationships membership
  join public.communities c on c.id = membership.community_id
  left join lateral (
    select owner_profile.type
    from public.community_relationships owner_relation
    join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
    where owner_relation.community_id = c.id and owner_relation.type = 'owner'
    order by owner_relation.updated_at_ms,owner_relation.profile_id
    limit 1
  ) owner on true
  where membership.profile_id = p_profile_id
    and membership.type in ('owner','moderator','connection')
    and c.privacy = 'public'
    and coalesce(owner.type,c.type) = source_profile.type;

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'privacy',q.privacy,
    'createdAt',q.created_at_ms,'lastActivity',q.last_activity_ms
  ) order by q.id),'[]'::jsonb)
  into items
  from (
    select
      c.id,c.name,c.url,c.picture,c.about,coalesce(owner.type,c.type) as type,
      c.privacy,c.created_at_ms,c.last_activity_ms
    from public.community_relationships membership
    join public.communities c on c.id = membership.community_id
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms,owner_relation.profile_id
      limit 1
    ) owner on true
    where membership.profile_id = p_profile_id
      and membership.type in ('owner','moderator','connection')
      and c.privacy = 'public'
      and coalesce(owner.type,c.type) = source_profile.type
    order by c.id
    offset ((page_number - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'items',items,'page',page_number,'pageSize',20,
    'totalItems',total,'totalPages',pages
  );
end;
$function$;

create or replace function public.nexus_search_entities(
  p_query text,
  p_scope text default 'all',
  p_page integer default 1,
  p_sort text default 'activity-desc'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  search_text text := private.nexus_forum_search_text(p_query);
  scope text := case when p_scope in ('profiles','communities') then p_scope else 'all' end;
  sort_order text := coalesce(p_sort,'activity-desc');
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  if sort_order not in ('activity-desc','activity-asc','name-asc','name-desc') then
    sort_order := 'activity-desc';
  end if;

  if search_text = '' then
    return jsonb_build_object(
      'items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1
    );
  end if;

  with matches as (
    select
      'profile'::text as kind,
      p.id::text as item_id,
      p.name as item_name,
      coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) as activity_value,
      jsonb_build_object(
        'kind','profile',
        'profile',jsonb_build_object(
          'id',p.id,'name',p.name,'url',p.url,'picture',p.picture,
          'about',p.about,'type',p.type,'createdAt',p.created_at_ms,
          'lastActivity',p.last_activity_ms
        )
      ) as payload
    from public.profiles p
    where scope in ('all','profiles')
      and strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url),search_text) > 0

    union all

    select
      'community'::text as kind,
      c.id::text as item_id,
      c.name as item_name,
      coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) as activity_value,
      jsonb_build_object(
        'kind','community',
        'community',jsonb_build_object(
          'id',c.id,'name',c.name,'url',c.url,'picture',c.picture,
          'about',c.about,'type',coalesce(owner.type,c.type),
          'privacy',c.privacy,'createdAt',c.created_at_ms,
          'lastActivity',c.last_activity_ms
        )
      ) as payload
    from public.communities c
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms,owner_relation.profile_id
      limit 1
    ) owner on true
    where scope in ('all','communities')
      and c.privacy = 'public'
      and strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0
  )
  select count(*)::bigint into total from matches;

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  with matches as (
    select
      p.id::text as item_id,
      p.name as item_name,
      coalesce(nullif(p.last_activity_ms,0),p.created_at_ms) as activity_value,
      jsonb_build_object(
        'kind','profile',
        'profile',jsonb_build_object(
          'id',p.id,'name',p.name,'url',p.url,'picture',p.picture,
          'about',p.about,'type',p.type,'createdAt',p.created_at_ms,
          'lastActivity',p.last_activity_ms
        )
      ) as payload
    from public.profiles p
    where scope in ('all','profiles')
      and strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url),search_text) > 0

    union all

    select
      c.id::text as item_id,
      c.name as item_name,
      coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) as activity_value,
      jsonb_build_object(
        'kind','community',
        'community',jsonb_build_object(
          'id',c.id,'name',c.name,'url',c.url,'picture',c.picture,
          'about',c.about,'type',coalesce(owner.type,c.type),
          'privacy',c.privacy,'createdAt',c.created_at_ms,
          'lastActivity',c.last_activity_ms
        )
      ) as payload
    from public.communities c
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms,owner_relation.profile_id
      limit 1
    ) owner on true
    where scope in ('all','communities')
      and c.privacy = 'public'
      and strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0
  )
  select coalesce(jsonb_agg(q.payload order by
    case when sort_order = 'activity-asc' then q.activity_value end asc,
    case when sort_order = 'activity-desc' then q.activity_value end desc,
    case when sort_order = 'name-asc' then lower(q.item_name) end asc,
    case when sort_order = 'name-desc' then lower(q.item_name) end desc,
    q.item_id
  ),'[]'::jsonb)
  into items
  from (
    select * from matches
    order by
      case when sort_order = 'activity-asc' then activity_value end asc,
      case when sort_order = 'activity-desc' then activity_value end desc,
      case when sort_order = 'name-asc' then lower(item_name) end asc,
      case when sort_order = 'name-desc' then lower(item_name) end desc,
      item_id
    offset ((page_number - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'items',items,'page',page_number,'pageSize',20,
    'totalItems',total,'totalPages',pages
  );
end;
$function$;

revoke all on function public.nexus_get_owned_profiles(uuid,integer) from public,authenticated;
grant execute on function public.nexus_get_owned_profiles(uuid,integer) to anon;
revoke all on function public.nexus_get_community_by_url(text,uuid) from public,authenticated;
grant execute on function public.nexus_get_community_by_url(text,uuid) to anon;
revoke all on function public.nexus_get_profile_communities(uuid,integer) from public,authenticated;
grant execute on function public.nexus_get_profile_communities(uuid,integer) to anon;
revoke all on function public.nexus_search_entities(text,text,integer,text) from public,authenticated;
grant execute on function public.nexus_search_entities(text,text,integer,text) to anon;

notify pgrst,'reload schema';
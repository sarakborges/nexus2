create or replace function public.nexus_get_communities_page(
  p_user_id uuid,
  p_page integer default 1,
  p_query text default null,
  p_sort text default 'activity-desc',
  p_community_tab text default 'all'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  a public.accounts%rowtype;
  owned uuid[] := array[]::uuid[];
  current_profile uuid;
  current_profile_row public.profiles%rowtype;
  current_profile_json jsonb;
  tab text := case when p_community_tab = 'managed' then 'managed' else 'all' end;
  sort_order text := coalesce(p_sort,'activity-desc');
  search_text text := private.nexus_forum_search_text(p_query);
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  select * into a from public.accounts where id = p_user_id;
  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(profile_id order by position),array[]::uuid[])
  into owned
  from public.account_profiles
  where account_id = p_user_id;

  if a.current_profile_id = any(owned) then
    current_profile := a.current_profile_id;
  else
    select profile_id into current_profile
    from public.account_profiles
    where account_id = p_user_id
    order by position
    limit 1;
  end if;

  if current_profile is not null then
    select * into current_profile_row
    from public.profiles where id = current_profile;
    current_profile_json := jsonb_build_object(
      'id',current_profile_row.id,'name',current_profile_row.name,
      'url',current_profile_row.url,'picture',current_profile_row.picture,
      'about',current_profile_row.about,'type',current_profile_row.type,
      'createdAt',current_profile_row.created_at_ms,
      'lastActivity',current_profile_row.last_activity_ms
    );
  end if;

  if sort_order not in ('activity-desc','activity-asc','name-asc','name-desc') then
    sort_order := 'activity-desc';
  end if;

  select count(*)::bigint into total
  from public.communities c
  left join lateral (
    select owner_profile.type
    from public.community_relationships owner_relation
    join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
    where owner_relation.community_id = c.id and owner_relation.type = 'owner'
    order by owner_relation.updated_at_ms, owner_relation.profile_id
    limit 1
  ) owner on true
  where (
    (tab = 'all' and c.privacy = 'public')
    or (
      tab = 'managed'
      and exists (
        select 1 from public.community_relationships relation
        where relation.community_id = c.id
          and relation.profile_id = any(owned)
          and relation.type in ('owner','moderator')
      )
    )
  )
  and (
    search_text = ''
    or strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0
  );

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'privacy',q.privacy,
    'createdAt',q.created_at_ms,'lastActivity',q.last_activity_ms
  ) order by
    case when sort_order = 'activity-asc' then q.activity_value end asc,
    case when sort_order = 'activity-desc' then q.activity_value end desc,
    case when sort_order = 'name-asc' then lower(q.name) end asc,
    case when sort_order = 'name-desc' then lower(q.name) end desc,
    q.id
  ),'[]'::jsonb)
  into items
  from (
    select c.id,c.name,c.url,c.picture,c.about,
      coalesce(owner.type,c.type) as type,c.privacy,
      c.created_at_ms,c.last_activity_ms,
      coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) as activity_value
    from public.communities c
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms, owner_relation.profile_id
      limit 1
    ) owner on true
    where (
      (tab = 'all' and c.privacy = 'public')
      or (
        tab = 'managed'
        and exists (
          select 1 from public.community_relationships relation
          where relation.community_id = c.id
            and relation.profile_id = any(owned)
            and relation.type in ('owner','moderator')
        )
      )
    )
    and (
      search_text = ''
      or strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0
    )
    order by
      case when sort_order = 'activity-asc' then coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) end asc,
      case when sort_order = 'activity-desc' then coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) end desc,
      case when sort_order = 'name-asc' then lower(c.name) end asc,
      case when sort_order = 'name-desc' then lower(c.name) end desc,
      c.id
    offset ((page_number - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'currentProfile',current_profile_json,
    'communityTab',tab,
    'communities',jsonb_build_object(
      'items',items,'page',page_number,'pageSize',20,
      'totalItems',total,'totalPages',pages
    )
  );
end;
$function$;

revoke all on function public.nexus_get_communities_page(uuid,integer,text,text,text) from public,authenticated;
grant execute on function public.nexus_get_communities_page(uuid,integer,text,text,text) to anon;
notify pgrst,'reload schema';
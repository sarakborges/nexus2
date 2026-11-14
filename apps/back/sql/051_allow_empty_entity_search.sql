-- Keep the public entity directory searchable even before a query term is entered.
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
  search_text text := coalesce(private.nexus_forum_search_text(p_query),'');
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
      and (search_text = '' or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url),search_text) > 0)

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
      and (search_text = '' or strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0)
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
      and (search_text = '' or strpos(private.nexus_forum_search_text(p.name || ' ' || p.about || ' ' || p.url),search_text) > 0)

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
      and (search_text = '' or strpos(private.nexus_forum_search_text(c.name || ' ' || c.about || ' ' || c.url),search_text) > 0)
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

revoke all on function public.nexus_search_entities(text,text,integer,text) from public,authenticated;
grant execute on function public.nexus_search_entities(text,text,integer,text) to anon;

notify pgrst,'reload schema';

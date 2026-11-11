create or replace function public.nexus_list_profiles(
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
  select count(*)::bigint into total from public.profiles;
  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms
  ) order by q.id),'[]'::jsonb)
  into items
  from (
    select p.* from public.profiles p
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

create or replace function public.nexus_get_profile_by_url(
  p_url text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where url = p_url limit 1;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002'; end if;

  return jsonb_build_object(
    'id',p.id,'name',p.name,'url',p.url,'picture',p.picture,
    'about',p.about,'type',p.type,'createdAt',p.created_at_ms,
    'lastActivity',p.last_activity_ms
  );
end;
$function$;

create or replace function public.nexus_list_public_communities(
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
  select count(*)::bigint into total
  from public.communities c
  where coalesce(c.privacy,'public') = 'public';

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
      c.id,c.name,c.url,c.picture,c.about,
      coalesce(owner.type,c.type) as type,
      case when c.privacy in ('public','private','unlisted') then c.privacy else 'public' end as privacy,
      coalesce(c.created_at_ms,0) as created_at_ms,
      coalesce(c.last_activity_ms,c.created_at_ms,0) as last_activity_ms
    from public.communities c
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms,owner_relation.profile_id
      limit 1
    ) owner on true
    where coalesce(c.privacy,'public') = 'public'
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

revoke all on function public.nexus_list_profiles(integer) from public,authenticated;
grant execute on function public.nexus_list_profiles(integer) to anon;
revoke all on function public.nexus_get_profile_by_url(text) from public,authenticated;
grant execute on function public.nexus_get_profile_by_url(text) to anon;
revoke all on function public.nexus_list_public_communities(integer) from public,authenticated;
grant execute on function public.nexus_list_public_communities(integer) to anon;

notify pgrst,'reload schema';
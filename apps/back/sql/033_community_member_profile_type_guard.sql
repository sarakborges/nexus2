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
    select 1 from public.community_relationships r
    where r.community_id = c.id and r.profile_id = any(owned)
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
create or replace function public.nexus_list_pending_members(
  p_user_id uuid,
  p_community_id uuid,
  p_actor_profile_id uuid,
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
  total bigint := 0;
  pages integer := 1;
  page_number integer := 1;
  items jsonb := '[]'::jsonb;
begin
  if not exists(select 1 from public.accounts where id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into c from public.communities where id = p_community_id;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002'; end if;

  select coalesce(array_agg(profile_id order by position),array[]::uuid[])
  into owned from public.account_profiles where account_id = p_user_id;
  if not (p_actor_profile_id = any(owned)) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;
  select p.type into actor_type
  from public.profiles p
  where p.id = p_actor_profile_id;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select r.type into actor_role
  from public.community_relationships r
  where r.community_id = c.id and r.profile_id = p_actor_profile_id;
  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms,r.profile_id limit 1;
  if found then c.type := owner_type; end if;

  if actor_type <> c.type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  select r.type into actor_role
  from public.community_relationships r
  where r.community_id = c.id and r.profile_id = p_actor_profile_id;
  if coalesce(actor_role,'') not in ('owner','moderator') then
    raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode = '42501';
  end if;

  select count(*)::bigint into total
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'requested' and p.type = c.type;

  pages := greatest(1,ceil(total::numeric / 20)::integer);
  page_number := least(greatest(coalesce(p_page,1),1),pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms,'role','requested'
  ) order by q.id),'[]'::jsonb)
  into items
  from (
    select p.*
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id and r.type = 'requested' and p.type = c.type
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
revoke all on function public.nexus_list_community_members(uuid,text,uuid,uuid,integer) from public,authenticated;
grant execute on function public.nexus_list_community_members(uuid,text,uuid,uuid,integer) to anon;
revoke all on function public.nexus_list_pending_members(uuid,uuid,uuid,integer) from public,authenticated;
grant execute on function public.nexus_list_pending_members(uuid,uuid,uuid,integer) to anon;

notify pgrst,'reload schema';

-- Suggestions are part of /auth/me. Only public communities of the
-- active profile's type are returned, excluding any existing relationship.
create or replace function public.nexus_get_suggested_communities(
  p_profile_id uuid,
  p_limit integer default 4
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_items jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 4), 12));
begin
  select * into v_profile
  from public.profiles
  where id = p_profile_id;

  if not found then
    return v_items;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'name',q.name,
    'url',q.url,
    'picture',q.picture,
    'about',q.about,
    'type',q.effective_type,
    'privacy',q.privacy,
    'createdAt',q.created_at_ms,
    'lastActivity',q.last_activity_ms
  ) order by q.activity_value desc, q.id),'[]'::jsonb)
  into v_items
  from (
    select
      c.id,
      c.name,
      c.url,
      c.picture,
      c.about,
      coalesce(owner.type,c.type) as effective_type,
      c.privacy,
      c.created_at_ms,
      c.last_activity_ms,
      coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) as activity_value
    from public.communities c
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile
        on owner_profile.id = owner_relation.profile_id
      where owner_relation.community_id = c.id
        and owner_relation.type = 'owner'
      order by owner_relation.updated_at_ms, owner_relation.profile_id
      limit 1
    ) owner on true
    where c.privacy = 'public'
      and coalesce(owner.type,c.type) = v_profile.type
      and not exists (
        select 1
        from public.community_relationships existing
        where existing.community_id = c.id
          and existing.profile_id = v_profile.id
      )
    order by
      coalesce(nullif(c.last_activity_ms,0),c.created_at_ms) desc,
      c.id
    limit v_limit
  ) q;

  return v_items;
end;
$function$;

revoke all on function public.nexus_get_suggested_communities(uuid,integer) from public,authenticated;
grant execute on function public.nexus_get_suggested_communities(uuid,integer) to anon;

notify pgrst,'reload schema';

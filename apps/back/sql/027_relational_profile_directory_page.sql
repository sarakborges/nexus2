create or replace function public.nexus_get_profile_directory_page(
  p_url text,
  p_kind text,
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
  v_profile public.profiles%rowtype;
  v_owned_profile_ids uuid[] := array[]::uuid[];
  v_current_profile_id uuid;
  v_current_profile_type text;
  v_viewer_relationship jsonb;
  v_search text := private.nexus_forum_search_text(p_query);
  v_sort text := coalesce(p_sort, 'activity-desc');
  v_total_items bigint := 0;
  v_total_pages integer := 1;
  v_page integer := 1;
  v_items jsonb := '[]'::jsonb;
  v_friend_ids uuid[] := array[]::uuid[];
  v_friend_relationships jsonb := '[]'::jsonb;
begin
  if p_kind not in ('friends','communities') then
    raise exception 'INVALID_PROFILE_DIRECTORY' using errcode = '22023';
  end if;
  if v_sort not in ('activity-desc','activity-asc','name-asc','name-desc') then
    v_sort := 'activity-desc';
  end if;

  if p_user_id is not null then
    if not exists (select 1 from public.accounts where id = p_user_id) then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;
    select coalesce(array_agg(profile_id order by position), array[]::uuid[])
    into v_owned_profile_ids
    from public.account_profiles
    where account_id = p_user_id;
    select a.current_profile_id
    into v_current_profile_id
    from public.accounts a
    where a.id = p_user_id
      and a.current_profile_id = any(v_owned_profile_ids);
    if found then
      select type into v_current_profile_type
      from public.profiles where id = v_current_profile_id;
    end if;
  end if;

  select * into v_profile
  from public.profiles
  where url = p_url
  limit 1;

  if not found then
    if p_kind = 'friends' then
      return jsonb_build_object(
        'kind','friends','profile',null,'viewerRelationship',null,'currentProfileType',v_current_profile_type,
        'friendRelationships','[]'::jsonb,
        'friends',jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1)
      );
    end if;
    return jsonb_build_object(
      'kind','communities','profile',null,'viewerRelationship',null,'currentProfileType',v_current_profile_type,
      'communities',jsonb_build_object('items','[]'::jsonb,'page',1,'pageSize',20,'totalItems',0,'totalPages',1)
    );
  end if;

  if v_current_profile_id is not null and v_current_profile_id <> v_profile.id then
    select jsonb_build_object(
      'profiles',jsonb_build_array(r.profile_id,r.related_profile_id),
      'type',r.type,
      'requestedBy',r.requested_by,
      'blockedBy',r.blocked_by,
      'updatedAt',r.updated_at_ms
    )
    into v_viewer_relationship
    from public.relationships r
    where r.profile_id = least(v_current_profile_id,v_profile.id)
      and r.related_profile_id = greatest(v_current_profile_id,v_profile.id)
    limit 1;
  end if;

  if p_kind = 'friends' then
    select count(*)::bigint
    into v_total_items
    from public.relationships r
    join public.profiles friend
      on friend.id = case
        when r.profile_id = v_profile.id then r.related_profile_id
        else r.profile_id
      end
    where r.type = 'connection'
      and (r.profile_id = v_profile.id or r.related_profile_id = v_profile.id)
      and friend.type = v_profile.type
      and (
        v_search = ''
        or strpos(private.nexus_forum_search_text(friend.name || ' ' || friend.about || ' ' || friend.url),v_search) > 0
      );

    v_total_pages := greatest(1,ceil(v_total_items::numeric / 20)::integer);
    v_page := least(greatest(coalesce(p_page,1),1),v_total_pages);

    select
      coalesce(array_agg(q.id),array[]::uuid[]),
      coalesce(jsonb_agg(jsonb_build_object(
        'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
        'about',q.about,'type',q.type,'createdAt',q.created_at_ms,
        'lastActivity',q.last_activity_ms
      ) order by
        case when v_sort = 'activity-asc' then q.activity_value end asc,
        case when v_sort = 'activity-desc' then q.activity_value end desc,
        case when v_sort = 'name-asc' then lower(q.name) end asc,
        case when v_sort = 'name-desc' then lower(q.name) end desc,
        q.id
      ),'[]'::jsonb)
    into v_friend_ids,v_items
    from (
      select friend.*,
        coalesce(nullif(friend.last_activity_ms,0),friend.created_at_ms) as activity_value
      from public.relationships r
      join public.profiles friend
        on friend.id = case
          when r.profile_id = v_profile.id then r.related_profile_id
          else r.profile_id
        end
      where r.type = 'connection'
        and (r.profile_id = v_profile.id or r.related_profile_id = v_profile.id)
        and friend.type = v_profile.type
        and (
          v_search = ''
          or strpos(private.nexus_forum_search_text(friend.name || ' ' || friend.about || ' ' || friend.url),v_search) > 0
        )
      order by
        case when v_sort = 'activity-asc' then coalesce(nullif(friend.last_activity_ms,0),friend.created_at_ms) end asc,
        case when v_sort = 'activity-desc' then coalesce(nullif(friend.last_activity_ms,0),friend.created_at_ms) end desc,
        case when v_sort = 'name-asc' then lower(friend.name) end asc,
        case when v_sort = 'name-desc' then lower(friend.name) end desc,
        friend.id
      offset ((v_page - 1) * 20)
      limit 20
    ) q;

    if v_current_profile_id is not null and cardinality(v_friend_ids) > 0 then
      select coalesce(jsonb_agg(jsonb_build_object(
        'profiles',jsonb_build_array(r.profile_id,r.related_profile_id),
        'type',r.type,'requestedBy',r.requested_by,
        'blockedBy',r.blocked_by,'updatedAt',r.updated_at_ms
      ) order by r.profile_id,r.related_profile_id),'[]'::jsonb)
      into v_friend_relationships
      from public.relationships r
      where (r.profile_id = v_current_profile_id or r.related_profile_id = v_current_profile_id)
        and (
          r.profile_id = any(v_friend_ids)
          or r.related_profile_id = any(v_friend_ids)
        );
    end if;

    return jsonb_build_object(
      'kind','friends',
      'profile',jsonb_build_object(
        'id',v_profile.id,'name',v_profile.name,'url',v_profile.url,
        'picture',v_profile.picture,'about',v_profile.about,'type',v_profile.type,
        'createdAt',v_profile.created_at_ms,'lastActivity',v_profile.last_activity_ms
      ),
      'viewerRelationship',v_viewer_relationship,
      'currentProfileType',v_current_profile_type,
      'friendRelationships',v_friend_relationships,
      'friends',jsonb_build_object(
        'items',v_items,'page',v_page,'pageSize',20,
        'totalItems',v_total_items,'totalPages',v_total_pages
      )
    );
  end if;

  select count(*)::bigint
  into v_total_items
  from public.community_relationships membership
  join public.communities community
    on community.id = membership.community_id
  left join lateral (
    select owner_profile.type
    from public.community_relationships owner_relationship
    join public.profiles owner_profile
      on owner_profile.id = owner_relationship.profile_id
    where owner_relationship.community_id = community.id
      and owner_relationship.type = 'owner'
    order by owner_relationship.updated_at_ms, owner_relationship.profile_id
    limit 1
  ) community_owner on true
  where membership.profile_id = v_profile.id
    and membership.type in ('owner','moderator','connection')
    and community.privacy = 'public'
    and coalesce(community_owner.type,community.type) = v_profile.type
    and (
      v_search = ''
      or strpos(private.nexus_forum_search_text(community.name || ' ' || community.about || ' ' || community.url),v_search) > 0
    );

  v_total_pages := greatest(1,ceil(v_total_items::numeric / 20)::integer);
  v_page := least(greatest(coalesce(p_page,1),1),v_total_pages);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'name',q.name,'url',q.url,'picture',q.picture,
    'about',q.about,'type',q.type,'privacy',q.privacy,
    'createdAt',q.created_at_ms,'lastActivity',q.last_activity_ms
  ) order by
    case when v_sort = 'activity-asc' then q.activity_value end asc,
    case when v_sort = 'activity-desc' then q.activity_value end desc,
    case when v_sort = 'name-asc' then lower(q.name) end asc,
    case when v_sort = 'name-desc' then lower(q.name) end desc,
    q.id
  ),'[]'::jsonb)
  into v_items
  from (
    select
      community.id,community.name,community.url,community.picture,community.about,
      coalesce(community_owner.type,community.type) as type,community.privacy,
      community.created_at_ms,community.last_activity_ms,
      coalesce(nullif(community.last_activity_ms,0),community.created_at_ms) as activity_value
    from public.community_relationships membership
    join public.communities community
      on community.id = membership.community_id
    left join lateral (
      select owner_profile.type
      from public.community_relationships owner_relationship
      join public.profiles owner_profile
        on owner_profile.id = owner_relationship.profile_id
      where owner_relationship.community_id = community.id
        and owner_relationship.type = 'owner'
      order by owner_relationship.updated_at_ms, owner_relationship.profile_id
      limit 1
    ) community_owner on true
    where membership.profile_id = v_profile.id
      and membership.type in ('owner','moderator','connection')
      and community.privacy = 'public'
      and coalesce(community_owner.type,community.type) = v_profile.type
      and (
        v_search = ''
        or strpos(private.nexus_forum_search_text(community.name || ' ' || community.about || ' ' || community.url),v_search) > 0
      )
    order by
      case when v_sort = 'activity-asc' then coalesce(nullif(community.last_activity_ms,0),community.created_at_ms) end asc,
      case when v_sort = 'activity-desc' then coalesce(nullif(community.last_activity_ms,0),community.created_at_ms) end desc,
      case when v_sort = 'name-asc' then lower(community.name) end asc,
      case when v_sort = 'name-desc' then lower(community.name) end desc,
      community.id
    offset ((v_page - 1) * 20)
    limit 20
  ) q;

  return jsonb_build_object(
    'kind','communities',
    'profile',jsonb_build_object(
      'id',v_profile.id,'name',v_profile.name,'url',v_profile.url,
      'picture',v_profile.picture,'about',v_profile.about,'type',v_profile.type,
      'createdAt',v_profile.created_at_ms,'lastActivity',v_profile.last_activity_ms
    ),
    'viewerRelationship',v_viewer_relationship,
    'currentProfileType',v_current_profile_type,
    'communities',jsonb_build_object(
      'items',v_items,'page',v_page,'pageSize',20,
      'totalItems',v_total_items,'totalPages',v_total_pages
    )
  );
end;
$function$;

revoke all on function public.nexus_get_profile_directory_page(text,text,uuid,integer,text,text) from public,authenticated;
grant execute on function public.nexus_get_profile_directory_page(text,text,uuid,integer,text,text) to anon;
notify pgrst,'reload schema';
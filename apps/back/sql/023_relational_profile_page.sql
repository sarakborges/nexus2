create or replace function public.nexus_get_profile_page(
  p_url text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_account public.accounts%rowtype;
  v_profile public.profiles%rowtype;
  v_profile_found boolean := false;
  v_current_profile_id uuid;
  v_current_profile_type text;
  v_viewer_relationship jsonb;
  v_friend_count bigint := 0;
  v_community_count bigint := 0;
  v_friends jsonb := '[]'::jsonb;
  v_communities jsonb := '[]'::jsonb;
  v_profile_json jsonb;
begin
  if p_user_id is not null then
    select account.*
    into v_account
    from public.accounts account
    where account.id = p_user_id;
    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.account_profiles membership
      where membership.account_id = p_user_id
        and membership.profile_id = v_account.current_profile_id
    ) then
      v_current_profile_id := v_account.current_profile_id;
      select profile.type
      into v_current_profile_type
      from public.profiles profile
      where profile.id = v_current_profile_id;
    end if;
  end if;

  select profile.*
  into v_profile
  from public.profiles profile
  where profile.url = p_url
  limit 1;

  v_profile_found := found;

  if not v_profile_found then
    return pg_catalog.jsonb_build_object(
      'profile', null,
      'viewerRelationship', null,
      'currentProfileType', v_current_profile_type,
      'friends', pg_catalog.jsonb_build_object(
        'items', '[]'::jsonb, 'page', 1, 'pageSize', 20,
        'totalItems', 0, 'totalPages', 1
      ),
      'communities', pg_catalog.jsonb_build_object(
        'items', '[]'::jsonb, 'page', 1, 'pageSize', 20,
        'totalItems', 0, 'totalPages', 1
      )
    );
  end if;

  if v_current_profile_id is not null and v_current_profile_id <> v_profile.id then
    select pg_catalog.jsonb_build_object(
      'profiles', pg_catalog.jsonb_build_array(relationship.profile_id, relationship.related_profile_id),
      'type', relationship.type,
      'requestedBy', relationship.requested_by,
      'blockedBy', relationship.blocked_by,
      'updatedAt', relationship.updated_at_ms
    )
    into v_viewer_relationship
    from public.relationships relationship
    where (
      relationship.profile_id = least(v_current_profile_id, v_profile.id)
      and relationship.related_profile_id = greatest(v_current_profile_id, v_profile.id)
    )
    limit 1;
  end if;

  select count(*)::bigint
  into v_friend_count
  from public.relationships relationship
  join public.profiles friend
    on friend.id = case
      when relationship.profile_id = v_profile.id then relationship.related_profile_id
      else relationship.profile_id
    end
  where relationship.type = 'connection'
    and (
      relationship.profile_id = v_profile.id
      or relationship.related_profile_id = v_profile.id
    )
    and friend.type = v_profile.type;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', page_rows.id,
        'name', page_rows.name,
        'url', page_rows.url,
        'picture', page_rows.picture,
        'about', page_rows.about,
        'type', page_rows.type,
        'createdAt', page_rows.created_at_ms,
        'lastActivity', page_rows.last_activity_ms
      )
      order by page_rows.id
    ),
    '[]'::jsonb
  )
  into v_friends
  from (
    select friend.*
    from public.relationships relationship
    join public.profiles friend
      on friend.id = case
        when relationship.profile_id = v_profile.id then relationship.related_profile_id
        else relationship.profile_id
      end
    where relationship.type = 'connection'
      and (
        relationship.profile_id = v_profile.id
        or relationship.related_profile_id = v_profile.id
      )
      and friend.type = v_profile.type
    order by friend.id
    limit 20
  ) page_rows;

  select count(*)::bigint
  into v_community_count
  from public.community_relationships membership
  join public.communities community
    on community.id = membership.community_id
  where membership.profile_id = v_profile.id
    and membership.type in ('owner', 'moderator', 'connection')
    and community.privacy = 'public'
    and coalesce((
      select owner_profile.type
      from public.community_relationships owner_relationship
      join public.profiles owner_profile
        on owner_profile.id = owner_relationship.profile_id
      where owner_relationship.community_id = community.id
        and owner_relationship.type = 'owner'
      order by owner_relationship.updated_at_ms, owner_relationship.profile_id
      limit 1
    ), community.type) = v_profile.type;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', page_rows.id,
        'name', page_rows.name,
        'url', page_rows.url,
        'picture', page_rows.picture,
        'about', page_rows.about,
        'type', page_rows.type,
        'privacy', page_rows.privacy,
        'createdAt', page_rows.created_at_ms,
        'lastActivity', page_rows.last_activity_ms
      )
      order by page_rows.id
    ),
    '[]'::jsonb
  )
  into v_communities
  from (
    select
      community.id,
      community.name,
      community.url,
      community.picture,
      community.about,
      coalesce((
        select owner_profile.type
        from public.community_relationships owner_relationship
        join public.profiles owner_profile
          on owner_profile.id = owner_relationship.profile_id
        where owner_relationship.community_id = community.id
          and owner_relationship.type = 'owner'
        order by owner_relationship.updated_at_ms, owner_relationship.profile_id
        limit 1
      ), community.type) as type,
      community.privacy,
      community.created_at_ms,
      community.last_activity_ms
    from public.community_relationships membership
    join public.communities community
      on community.id = membership.community_id
    where membership.profile_id = v_profile.id
      and membership.type in ('owner', 'moderator', 'connection')
      and community.privacy = 'public'
      and coalesce((
        select owner_profile.type
        from public.community_relationships owner_relationship
        join public.profiles owner_profile
          on owner_profile.id = owner_relationship.profile_id
        where owner_relationship.community_id = community.id
          and owner_relationship.type = 'owner'
        order by owner_relationship.updated_at_ms, owner_relationship.profile_id
        limit 1
      ), community.type) = v_profile.type
    order by community.id
    limit 20
  ) page_rows;

  v_profile_json := pg_catalog.jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'url', v_profile.url,
    'picture', v_profile.picture,
    'about', v_profile.about,
    'type', v_profile.type,
    'createdAt', v_profile.created_at_ms,
    'lastActivity', v_profile.last_activity_ms
  );

  return pg_catalog.jsonb_build_object(
    'profile', v_profile_json,
    'viewerRelationship', v_viewer_relationship,
    'currentProfileType', v_current_profile_type,
    'friends', pg_catalog.jsonb_build_object(
      'items', v_friends,
      'page', 1,
      'pageSize', 20,
      'totalItems', v_friend_count,
      'totalPages', greatest(1, pg_catalog.ceil(v_friend_count::numeric / 20)::integer)
    ),
    'communities', pg_catalog.jsonb_build_object(
      'items', v_communities,
      'page', 1,
      'pageSize', 20,
      'totalItems', v_community_count,
      'totalPages', greatest(1, pg_catalog.ceil(v_community_count::numeric / 20)::integer)
    )
  );
end;
$function$;

revoke all on function public.nexus_get_profile_page(text,uuid) from public, authenticated;
grant execute on function public.nexus_get_profile_page(text,uuid) to anon;

notify pgrst, 'reload schema';
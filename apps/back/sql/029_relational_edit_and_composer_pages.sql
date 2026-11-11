create or replace function public.nexus_get_profile_edit_page(
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
  v_profile_json jsonb;
  v_current_profile_type text;
begin
  if p_user_id is not null then
    select * into v_account
    from public.accounts
    where id = p_user_id;
    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.account_profiles membership
      where membership.account_id = p_user_id
        and membership.profile_id = v_account.current_profile_id
    ) then
      select profile.type into v_current_profile_type
      from public.profiles profile
      where profile.id = v_account.current_profile_id;
    end if;
  end if;

  select * into v_profile
  from public.profiles
  where url = p_url
  limit 1;

  if found then
    v_profile_json := jsonb_build_object(
      'id',v_profile.id,'name',v_profile.name,'url',v_profile.url,
      'picture',v_profile.picture,'about',v_profile.about,'type',v_profile.type,
      'createdAt',v_profile.created_at_ms,'lastActivity',v_profile.last_activity_ms
    );
  end if;

  return jsonb_build_object(
    'profile',v_profile_json,
    'currentProfileType',v_current_profile_type
  );
end;
$function$;

create or replace function public.nexus_get_community_edit_page(
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
  a public.accounts%rowtype;
  owner_type text;
  owned uuid[] := array[]::uuid[];
  current_type text;
  owner_profile uuid;
  is_member boolean := false;
  community_json jsonb;
begin
  select * into c
  from public.communities
  where url = p_url
  limit 1;

  if not found then
    return jsonb_build_object(
      'community',null,'ownerProfileId',null,'currentProfileType',null
    );
  end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms, r.profile_id
  limit 1;
  if found then c.type := owner_type; end if;

  if p_user_id is not null then
    select * into a from public.accounts where id = p_user_id;
    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(array_agg(profile_id order by position),array[]::uuid[])
    into owned
    from public.account_profiles
    where account_id = p_user_id;

    if a.current_profile_id = any(owned) then
      select p.type into current_type
      from public.profiles p where p.id = a.current_profile_id;
    end if;

    select exists (
      select 1 from public.community_relationships r
      where r.community_id = c.id
        and r.profile_id = any(owned)
        and r.type in ('owner','moderator','connection')
    ) into is_member;

    select r.profile_id into owner_profile
    from public.community_relationships r
    join public.profiles p on p.id = r.profile_id
    where r.community_id = c.id
      and r.profile_id = any(owned)
      and p.type = c.type
      and r.type = 'owner'
    order by r.updated_at_ms desc, r.profile_id
    limit 1;
  end if;

  community_json := jsonb_build_object(
    'id',c.id,'name',c.name,'url',c.url,
    'picture',case when c.privacy = 'private' and not is_member then '' else c.picture end,
    'about',case when c.privacy = 'private' and not is_member then '' else c.about end,
    'type',c.type,'privacy',c.privacy,
    'createdAt',c.created_at_ms,'lastActivity',c.last_activity_ms
  );

  return jsonb_build_object(
    'community',community_json,
    'ownerProfileId',owner_profile,
    'currentProfileType',current_type
  );
end;
$function$;

create or replace function public.nexus_get_community_forum_composer_page(
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
  a public.accounts%rowtype;
  owner_type text;
  owned uuid[] := array[]::uuid[];
  current_id uuid;
  current_type text;
  viewer_relationship jsonb;
  forum_profile public.profiles%rowtype;
  forum_profile_json jsonb;
  is_member boolean := false;
  community_json jsonb;
begin
  select * into c from public.communities
  where url = p_url limit 1;

  if not found then
    return jsonb_build_object(
      'community',null,'forumProfile',null,
      'viewerRelationship',null,'currentProfileType',null
    );
  end if;

  select p.type into owner_type
  from public.community_relationships r
  join public.profiles p on p.id = r.profile_id
  where r.community_id = c.id and r.type = 'owner'
  order by r.updated_at_ms, r.profile_id
  limit 1;
  if found then c.type := owner_type; end if;

  if p_user_id is not null then
    select * into a from public.accounts where id = p_user_id;
    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(array_agg(profile_id order by position),array[]::uuid[])
    into owned
    from public.account_profiles
    where account_id = p_user_id;

    if a.current_profile_id = any(owned) then
      current_id := a.current_profile_id;
      select p.type into current_type
      from public.profiles p where p.id = current_id;
    end if;

    select exists (
      select 1 from public.community_relationships r
      where r.community_id = c.id
        and r.profile_id = any(owned)
        and r.type in ('owner','moderator','connection')
    ) into is_member;

    if current_id is not null then
      select jsonb_build_object(
        'profiles',jsonb_build_array(r.profile_id,r.community_id),
        'type',r.type,'requestedBy',r.requested_by,
        'blockedBy',r.blocked_by,'updatedAt',r.updated_at_ms
      )
      into viewer_relationship
      from public.community_relationships r
      where r.community_id = c.id
        and r.profile_id = current_id
      limit 1;
    end if;

    select p.*
    into forum_profile
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    join public.community_relationships r
      on r.profile_id = ap.profile_id
      and r.community_id = c.id
    where ap.account_id = p_user_id
      and p.type = c.type
      and r.type in ('owner','moderator','connection')
    order by
      (ap.profile_id = current_id) desc,
      case r.type when 'owner' then 0 when 'moderator' then 1 else 2 end,
      ap.position
    limit 1;

    if found then
      forum_profile_json := jsonb_build_object(
        'id',forum_profile.id,'name',forum_profile.name,
        'url',forum_profile.url,'picture',forum_profile.picture,
        'about',forum_profile.about,'type',forum_profile.type,
        'createdAt',forum_profile.created_at_ms,
        'lastActivity',forum_profile.last_activity_ms
      );
    end if;
  end if;

  community_json := jsonb_build_object(
    'id',c.id,'name',c.name,'url',c.url,
    'picture',case when c.privacy = 'private' and not is_member then '' else c.picture end,
    'about',case when c.privacy = 'private' and not is_member then '' else c.about end,
    'type',c.type,'privacy',c.privacy,
    'createdAt',c.created_at_ms,'lastActivity',c.last_activity_ms
  );

  return jsonb_build_object(
    'community',community_json,
    'forumProfile',forum_profile_json,
    'viewerRelationship',viewer_relationship,
    'currentProfileType',current_type
  );
end;
$function$;

revoke all on function public.nexus_get_profile_edit_page(text,uuid) from public,authenticated;
grant execute on function public.nexus_get_profile_edit_page(text,uuid) to anon;
revoke all on function public.nexus_get_community_edit_page(text,uuid) from public,authenticated;
grant execute on function public.nexus_get_community_edit_page(text,uuid) to anon;
revoke all on function public.nexus_get_community_forum_composer_page(text,uuid) from public,authenticated;
grant execute on function public.nexus_get_community_forum_composer_page(text,uuid) to anon;

notify pgrst,'reload schema';
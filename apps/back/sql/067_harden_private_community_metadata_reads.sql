-- Apply effective community profile-type membership rules consistently
-- to every remaining private-community metadata and Storage read surface.
begin;

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
      select 1
      from public.community_relationships r
      join public.profiles member_profile on member_profile.id = r.profile_id
      where r.community_id = c.id
        and r.profile_id = any(owned)
        and member_profile.type = c.type
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
      select 1
      from public.community_relationships r
      join public.profiles member_profile on member_profile.id = r.profile_id
      where r.community_id = c.id
        and r.profile_id = any(owned)
        and member_profile.type = c.type
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
      select 1
      from public.community_relationships r
      join public.profiles member_profile on member_profile.id = r.profile_id
      where r.community_id = c.id
        and r.profile_id = any(owned)
        and member_profile.type = c.type
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

create or replace function public.nexus_get_editor_image(
  p_user_id uuid,
  p_id uuid,
  p_now_ms bigint
)
returns setof public.media_files
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_file public.media_files%rowtype;
  v_community_id uuid;
  v_privacy text;
  v_community_type text;
  v_from uuid;
  v_to uuid;
begin
  select file.* into v_file from public.media_files file
  where file.id=p_id for share;
  if not found or v_file.purpose<>'editor-image'
     or (v_file.status<>'ready' and not (
       v_file.status='deleting'
       and v_file.resource_type is not null
       and v_file.resource_id is not null
     ))
     or ((v_file.resource_type is null and v_file.resource_id is null)
       and v_file.expires_at_ms is not null and v_file.expires_at_ms<=p_now_ms) then
    raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
  end if;

  if v_file.resource_type is null then
    if p_user_id is distinct from v_file.owner_user_id then
      raise exception 'UPLOAD_ACCESS_DENIED' using errcode='42501';
    end if;
    return next v_file; return;
  end if;

  if v_file.resource_type='profile' then
    if not exists(select 1 from public.profiles profile where profile.id=v_file.resource_id) then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
    return next v_file; return;
  end if;

  if v_file.resource_type='profile-post' then
    if not exists(select 1 from public.profile_posts post where post.id=v_file.resource_id) then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
    return next v_file; return;
  end if;

  if v_file.resource_type in ('community','community-forum-topic','community-forum-reply') then
    v_community_id:=v_file.resource_id;
    if v_file.resource_type='community-forum-topic' then
      select topic.community_id into v_community_id
      from public.community_forum_topics topic where topic.id=v_file.resource_id;
    elsif v_file.resource_type='community-forum-reply' then
      select reply.community_id into v_community_id
      from public.community_forum_replies reply where reply.id=v_file.resource_id;
    end if;
    select
      community.privacy,
      coalesce((
        select owner_profile.type
        from public.community_relationships owner_relation
        join public.profiles owner_profile
          on owner_profile.id = owner_relation.profile_id
        where owner_relation.community_id = community.id
          and owner_relation.type = 'owner'
        order by owner_relation.updated_at_ms, owner_relation.profile_id
        limit 1
      ), community.type)
    into v_privacy,v_community_type
    from public.communities community
    where community.id=v_community_id;
    if not found then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
    if v_privacy='private' then
      if p_user_id is null then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
      if not exists(select 1 from public.accounts account where account.id=p_user_id) then
        raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
      end if;
      if not exists(
        select 1
        from public.account_profiles membership
        join public.community_relationships relation
          on relation.profile_id=membership.profile_id
        join public.profiles member_profile
          on member_profile.id=membership.profile_id
        where membership.account_id=p_user_id
          and relation.community_id=v_community_id
          and relation.type in ('owner','moderator','connection')
          and member_profile.type=v_community_type
      ) then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
    end if;
    return next v_file; return;
  end if;

  if v_file.resource_type='profile-message' then
    if p_user_id is null then raise exception 'UPLOAD_ACCESS_DENIED' using errcode='42501'; end if;
    if not exists(select 1 from public.accounts account where account.id=p_user_id) then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
    end if;
    select message.from_profile_id,message.to_profile_id into v_from,v_to
    from public.profile_messages message
    where message.id=v_file.resource_id;
    if not found or v_from is distinct from v_file.message_from_profile_id
      or v_to is distinct from v_file.message_to_profile_id then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
    if not exists(select 1 from public.account_profiles membership
      where membership.account_id=p_user_id and membership.profile_id in (v_from,v_to)) then
      raise exception 'UPLOAD_ACCESS_DENIED' using errcode='42501';
    end if;
    return next v_file; return;
  end if;

  raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
end;
$function$;

notify pgrst, 'reload schema';
commit;

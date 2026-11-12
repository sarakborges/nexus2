create or replace function public.nexus_create_profile(
  p_user_id uuid, p_profile_id uuid, p_name text, p_url text, p_picture text,
  p_about text, p_type text, p_created_at_ms bigint,
  p_avatar_path text default null, p_editor_image_ids uuid[] default array[]::uuid[]
)
returns table(account_id uuid,email text,profiles uuid[],current_profile_id uuid)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_position integer;
  v_image_ids uuid[] := coalesce(p_editor_image_ids,array[]::uuid[]);
  v_expected_image_count integer;
  v_ready_image_count integer;
  v_avatar_count integer;
  v_profiles uuid[];
begin
  perform private.nexus_lock_collection_versions(array['accounts','profiles','media_files']::text[]);
  if p_user_id is null or p_profile_id is null or p_created_at_ms is null
     or nullif(btrim(p_name),'') is null or nullif(p_url,'') is null
     or p_about is null or char_length(p_about)>8000 or p_picture is null
     or p_type not in ('social','rp','business')
     or p_url !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_PROFILE' using errcode='22023';
  end if;
  perform 1 from public.accounts account where account.id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  if exists(select 1 from public.profiles profile where profile.id=p_profile_id) then
    raise exception 'PROFILE_ID_ALREADY_EXISTS' using errcode='23505';
  end if;
  if exists(select 1 from public.profiles profile where profile.url=p_url) then
    raise exception 'PROFILE_URL_ALREADY_IN_USE' using errcode='23505';
  end if;

  v_expected_image_count := cardinality(v_image_ids);
  if exists(select image_id from unnest(v_image_ids) as image_id group by image_id having count(*)>1) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;
  perform file.id from public.media_files file
  where file.id=any(v_image_ids) and file.owner_user_id=p_user_id
    and file.purpose='editor-image' and file.status='ready'
    and (file.expires_at_ms is null or file.expires_at_ms>p_created_at_ms)
    and file.resource_type is null and file.resource_id is null
  for update;
  get diagnostics v_ready_image_count=row_count;
  if v_ready_image_count<>v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;

  if p_avatar_path is not null then
    perform file.id from public.media_files file
    where file.owner_user_id=p_user_id and file.purpose='profile-avatar'
      and file.bucket='nexus-avatars' and file.path=p_avatar_path
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>p_created_at_ms-86400000
    for update;
    get diagnostics v_avatar_count=row_count;
    if v_avatar_count<>1 then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
  end if;

  select coalesce(max(membership.position)+1,0) into v_position
  from public.account_profiles membership where membership.account_id=p_user_id;
  insert into public.profiles(id,name,url,picture,about,type,created_at_ms,last_activity_ms)
  values(p_profile_id,btrim(p_name),p_url,p_picture,p_about,p_type,p_created_at_ms,p_created_at_ms);
  insert into public.account_profiles(account_id,profile_id,position)
  values(p_user_id,p_profile_id,v_position);
  update public.accounts set current_profile_id=p_profile_id where id=p_user_id;

  if p_avatar_path is not null then
    update public.media_files set resource_type='profile',resource_id=p_profile_id
    where owner_user_id=p_user_id and purpose='profile-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='profile',resource_id=p_profile_id,
    message_from_profile_id=null,message_to_profile_id=null
  where id=any(v_image_ids);

  select coalesce(array_agg(membership.profile_id order by membership.position),array[]::uuid[])
  into v_profiles from public.account_profiles membership
  where membership.account_id=p_user_id;
  perform private.nexus_bump_collection_versions(array['accounts','profiles','media_files']::text[]);
  return query select account.id,account.email,v_profiles,account.current_profile_id
  from public.accounts account where account.id=p_user_id;
end;
$function$;

create or replace function public.nexus_update_profile(
  p_user_id uuid,p_profile_id uuid,p_name text,p_url text,p_picture text,p_about text,
  p_last_activity_ms bigint,p_avatar_path text default null,
  p_editor_image_ids uuid[] default array[]::uuid[]
)
returns table(
  id uuid,name text,url text,picture text,about text,type text,
  created_at_ms bigint,last_activity_ms bigint,previous_picture text
)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_previous_picture text;
  v_image_ids uuid[] := coalesce(p_editor_image_ids,array[]::uuid[]);
  v_expected_image_count integer;
  v_ready_image_count integer;
  v_avatar_count integer;
  v_picture_changed boolean;
begin
  perform private.nexus_lock_collection_versions(array['accounts','profiles','media_files']::text[]);
  if p_user_id is null or p_profile_id is null or p_last_activity_ms is null
     or nullif(btrim(p_name),'') is null or nullif(p_url,'') is null
     or p_about is null or char_length(p_about)>8000 or p_picture is null
     or p_url !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_PROFILE' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts account where account.id=p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
  end if;
  select profile.* into v_profile from public.profiles profile
  where profile.id=p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  if not exists(select 1 from public.account_profiles membership
    where membership.account_id=p_user_id and membership.profile_id=p_profile_id) then
    raise exception 'PROFILE_NOT_OWNED' using errcode='42501';
  end if;
  if exists(select 1 from public.profiles profile
    where profile.id<>p_profile_id and profile.url=p_url) then
    raise exception 'PROFILE_URL_ALREADY_IN_USE' using errcode='23505';
  end if;

  v_previous_picture:=v_profile.picture;
  v_picture_changed:=v_previous_picture is distinct from p_picture;
  if v_picture_changed and p_avatar_path is not null then
    perform file.id from public.media_files file
    where file.owner_user_id=p_user_id and file.purpose='profile-avatar'
      and file.bucket='nexus-avatars' and file.path=p_avatar_path
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>p_last_activity_ms-86400000
    for update;
    get diagnostics v_avatar_count=row_count;
    if v_avatar_count<>1 then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
  end if;

  v_expected_image_count:=cardinality(v_image_ids);
  if exists(select image_id from unnest(v_image_ids) as image_id group by image_id having count(*)>1) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;
  -- Existing attachments remain valid; only new references must be ready and unexpired.
  perform file.id from public.media_files file
  where file.id=any(v_image_ids) and file.owner_user_id=p_user_id
    and file.purpose='editor-image'
    and (
      (file.resource_type='profile' and file.resource_id=p_profile_id)
      or (file.resource_type is null and file.resource_id is null
        and file.status='ready'
        and (file.expires_at_ms is null or file.expires_at_ms>p_last_activity_ms))
    )
  for update;
  get diagnostics v_ready_image_count=row_count;
  if v_ready_image_count<>v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;

  update public.media_files set resource_type=null,resource_id=null,
    message_from_profile_id=null,message_to_profile_id=null
  where resource_type='profile' and resource_id=p_profile_id and not(id=any(v_image_ids));
  update public.profiles set name=btrim(p_name),url=p_url,picture=p_picture,about=p_about,
    last_activity_ms=greatest(last_activity_ms,p_last_activity_ms)
  where public.profiles.id=p_profile_id
  returning public.profiles.* into v_profile;
  if v_picture_changed and p_avatar_path is not null then
    update public.media_files set resource_type='profile',resource_id=p_profile_id
    where owner_user_id=p_user_id and purpose='profile-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='profile',resource_id=p_profile_id,
    message_from_profile_id=null,message_to_profile_id=null where id=any(v_image_ids);
  perform private.nexus_bump_collection_versions(array['profiles','media_files']::text[]);
  return query select v_profile.id,v_profile.name,v_profile.url,v_profile.picture,
    v_profile.about,v_profile.type,v_profile.created_at_ms,v_profile.last_activity_ms,
    case when v_picture_changed then v_previous_picture else null end;
end;
$function$;

create or replace function public.nexus_create_community(
  p_user_id uuid,p_owner_profile_id uuid,p_community_id uuid,p_name text,p_url text,
  p_picture text,p_about text,p_privacy text,p_created_at_ms bigint,
  p_avatar_path text default null,p_editor_image_ids uuid[] default array[]::uuid[]
)
returns table(
  id uuid,name text,url text,picture text,about text,type text,privacy text,
  created_at_ms bigint,last_activity_ms bigint
)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_profile_type text;
  v_position integer;
  v_image_ids uuid[]:=coalesce(p_editor_image_ids,array[]::uuid[]);
  v_expected_image_count integer;
  v_ready_image_count integer;
  v_avatar_count integer;
  v_community public.communities%rowtype;
begin
  perform private.nexus_lock_collection_versions(array['profiles','communities','community_relationships','media_files']::text[]);
  if p_user_id is null or p_owner_profile_id is null or p_community_id is null
     or p_created_at_ms is null or nullif(btrim(p_name),'') is null or nullif(p_url,'') is null
     or p_picture is null or p_about is null or char_length(p_about)>8000
     or p_privacy not in ('public','private','unlisted')
     or p_url !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_COMMUNITY' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts account where account.id=p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
  end if;
  select profile.type into v_profile_type from public.profiles profile
  join public.account_profiles membership on membership.profile_id=profile.id
  where membership.account_id=p_user_id and profile.id=p_owner_profile_id
  for share of profile;
  if not found then raise exception 'PROFILE_NOT_OWNED' using errcode='42501'; end if;
  if exists(select 1 from public.communities community where community.url=p_url) then
    raise exception 'COMMUNITY_URL_ALREADY_IN_USE' using errcode='23505';
  end if;

  v_expected_image_count:=cardinality(v_image_ids);
  if exists(select image_id from unnest(v_image_ids) as image_id group by image_id having count(*)>1) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;
  perform file.id from public.media_files file
  where file.id=any(v_image_ids) and file.owner_user_id=p_user_id
    and file.purpose='editor-image' and file.status='ready'
    and (file.expires_at_ms is null or file.expires_at_ms>p_created_at_ms)
    and file.resource_type is null and file.resource_id is null
  for update;
  get diagnostics v_ready_image_count=row_count;
  if v_ready_image_count<>v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;

  if p_avatar_path is not null then
    perform file.id from public.media_files file
    where file.owner_user_id=p_user_id and file.purpose='community-avatar'
      and file.bucket='nexus-avatars' and file.path=p_avatar_path
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>p_created_at_ms-86400000
    for update;
    get diagnostics v_avatar_count=row_count;
    if v_avatar_count<>1 then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
  end if;

  insert into public.communities(id,name,url,picture,about,type,privacy,created_at_ms,last_activity_ms)
  values(p_community_id,btrim(p_name),p_url,p_picture,p_about,v_profile_type,p_privacy,p_created_at_ms,p_created_at_ms)
  returning * into v_community;
  insert into public.community_relationships(profile_id,community_id,type,requested_by,blocked_by,updated_at_ms)
  values(p_owner_profile_id,p_community_id,'owner',null,null,p_created_at_ms);
  update public.profiles set last_activity_ms=greatest(last_activity_ms,p_created_at_ms)
  where id=p_owner_profile_id;
  if p_avatar_path is not null then
    update public.media_files set resource_type='community',resource_id=p_community_id
    where owner_user_id=p_user_id and purpose='community-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='community',resource_id=p_community_id,
    message_from_profile_id=null,message_to_profile_id=null where id=any(v_image_ids);
  perform private.nexus_bump_collection_versions(array['profiles','communities','community_relationships','media_files']::text[]);
  return query select v_community.id,v_community.name,v_community.url,v_community.picture,
    v_community.about,v_community.type,v_community.privacy,v_community.created_at_ms,v_community.last_activity_ms;
end;
$function$;

create or replace function public.nexus_update_community(
  p_user_id uuid,p_community_id uuid,p_name text,p_url text,p_picture text,p_about text,
  p_privacy text default null,p_last_activity_ms bigint default null,
  p_avatar_path text default null,p_editor_image_ids uuid[] default array[]::uuid[]
)
returns table(
  id uuid,name text,url text,picture text,about text,type text,privacy text,
  created_at_ms bigint,last_activity_ms bigint,previous_picture text
)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_community public.communities%rowtype;
  v_owner_profile_id uuid;
  v_profile_type text;
  v_image_ids uuid[]:=coalesce(p_editor_image_ids,array[]::uuid[]);
  v_expected_image_count integer;
  v_ready_image_count integer;
  v_avatar_count integer;
  v_picture_changed boolean;
  v_previous_picture text;
begin
  perform private.nexus_lock_collection_versions(array['profiles','communities','community_relationships','media_files']::text[]);
  if p_user_id is null or p_community_id is null or p_last_activity_ms is null
     or nullif(btrim(p_name),'') is null or nullif(p_url,'') is null
     or p_picture is null or p_about is null or char_length(p_about)>8000
     or (p_privacy is not null and p_privacy not in ('public','private','unlisted'))
     or p_url !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'INVALID_COMMUNITY' using errcode='22023';
  end if;
  select community.* into v_community from public.communities community
  where community.id=p_community_id for update;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  select relation.profile_id,owner_profile.type into v_owner_profile_id,v_profile_type
  from public.community_relationships relation
  join public.profiles owner_profile on owner_profile.id=relation.profile_id
  where relation.community_id=p_community_id and relation.type='owner'
  order by relation.updated_at_ms asc limit 1
  for share of relation,owner_profile;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  if not exists(select 1 from public.account_profiles membership
    where membership.account_id=p_user_id and membership.profile_id=v_owner_profile_id) then
    raise exception 'PROFILE_NOT_OWNED' using errcode='42501';
  end if;
  if exists(select 1 from public.communities community
    where community.id<>p_community_id and community.url=p_url) then
    raise exception 'COMMUNITY_URL_ALREADY_IN_USE' using errcode='23505';
  end if;

  v_previous_picture:=v_community.picture;
  v_picture_changed:=v_previous_picture is distinct from p_picture;
  if v_picture_changed and p_avatar_path is not null then
    perform file.id from public.media_files file
    where file.owner_user_id=p_user_id and file.purpose='community-avatar'
      and file.bucket='nexus-avatars' and file.path=p_avatar_path
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>p_last_activity_ms-86400000
    for update;
    get diagnostics v_avatar_count=row_count;
    if v_avatar_count<>1 then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
  end if;

  v_expected_image_count:=cardinality(v_image_ids);
  if exists(select image_id from unnest(v_image_ids) as image_id group by image_id having count(*)>1) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;
  perform file.id from public.media_files file
  where file.id=any(v_image_ids) and file.owner_user_id=p_user_id
    and file.purpose='editor-image'
    and (
      (file.resource_type='community' and file.resource_id=p_community_id)
      or (file.resource_type is null and file.resource_id is null
        and file.status='ready'
        and (file.expires_at_ms is null or file.expires_at_ms>p_last_activity_ms))
    )
  for update;
  get diagnostics v_ready_image_count=row_count;
  if v_ready_image_count<>v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode='22023';
  end if;

  update public.media_files set resource_type=null,resource_id=null,
    message_from_profile_id=null,message_to_profile_id=null
  where resource_type='community' and resource_id=p_community_id
    and not(id=any(v_image_ids));
  update public.communities set name=btrim(p_name),url=p_url,picture=p_picture,about=p_about,
    type=v_profile_type,privacy=coalesce(p_privacy,v_community.privacy),
    last_activity_ms=greatest(last_activity_ms,p_last_activity_ms)
  where public.communities.id=p_community_id
  returning public.communities.* into v_community;
  if v_picture_changed and p_avatar_path is not null then
    update public.media_files set resource_type='community',resource_id=p_community_id
    where owner_user_id=p_user_id and purpose='community-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='community',resource_id=p_community_id,
    message_from_profile_id=null,message_to_profile_id=null where id=any(v_image_ids);
  perform private.nexus_bump_collection_versions(array['communities','media_files']::text[]);
  return query select v_community.id,v_community.name,v_community.url,v_community.picture,
    v_community.about,v_community.type,v_community.privacy,v_community.created_at_ms,
    v_community.last_activity_ms,case when v_picture_changed then v_previous_picture else null end;
end;
$function$;

revoke all on function public.nexus_create_profile(uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) from public,authenticated;
revoke all on function public.nexus_update_profile(uuid,uuid,text,text,text,text,bigint,text,uuid[]) from public,authenticated;
revoke all on function public.nexus_create_community(uuid,uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) from public,authenticated;
revoke all on function public.nexus_update_community(uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) from public,authenticated;
grant execute on function public.nexus_create_profile(uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) to anon;
grant execute on function public.nexus_update_profile(uuid,uuid,text,text,text,text,bigint,text,uuid[]) to anon;
grant execute on function public.nexus_create_community(uuid,uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) to anon;
grant execute on function public.nexus_update_community(uuid,uuid,text,text,text,text,text,bigint,text,uuid[]) to anon;
notify pgrst,'reload schema';

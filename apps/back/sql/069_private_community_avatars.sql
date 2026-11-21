-- Separate community avatars from public profile avatars.
-- Community image reads are authorized against the current community membership.
begin;

insert into storage.buckets (
  id,name,public,file_size_limit,allowed_mime_types
)
values (
  'nexus-community-avatars',
  'nexus-community-avatars',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict (id) do update
set name=excluded.name,
    public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.nexus_create_upload(
  p_id uuid,p_user_id uuid,p_purpose text,p_bucket text,p_path text,
  p_content_type text,p_expected_size bigint,p_created_at_ms bigint,
  p_target_id uuid default null,p_actor_profile_id uuid default null
)
returns void
language plpgsql security invoker set search_path=''
as $function$
declare
  v_actor_type text;
  v_owner_type text;
  v_current_type text;
  v_role text;
begin
  perform private.nexus_lock_collection_versions(
    array['accounts','profiles','communities','community_relationships','media_files']::text[]
  );
  if p_id is null or p_user_id is null or p_created_at_ms is null
     or p_expected_size is null or p_expected_size < 1
     or p_path is null or p_content_type is null
     or p_purpose not in ('profile-avatar','community-avatar','editor-image')
     or (p_purpose='editor-image' and p_bucket<>'nexus-editor-images')
     or (p_purpose='profile-avatar' and p_bucket<>'nexus-avatars')
     or (p_purpose='community-avatar' and p_bucket<>'nexus-community-avatars') then
    raise exception 'INVALID_UPLOAD' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts account where account.id=p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
  end if;

  if p_purpose='profile-avatar' and p_target_id is not null then
    select profile.type into v_actor_type
    from public.profiles profile
    join public.account_profiles membership on membership.profile_id=profile.id
    where membership.account_id=p_user_id and profile.id=p_target_id
    for share of profile;
    if not found then raise exception 'PROFILE_NOT_OWNED' using errcode='42501'; end if;
    select active_profile.type into v_current_type
    from public.accounts account
    join public.profiles active_profile on active_profile.id=account.current_profile_id
    where account.id=p_user_id;
    if v_current_type is not null and v_actor_type is distinct from v_current_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
    end if;
  end if;

  if p_purpose='community-avatar' and p_target_id is not null then
    if p_actor_profile_id is null then raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode='42501'; end if;
    select actor.type into v_actor_type
    from public.profiles actor
    join public.account_profiles membership on membership.profile_id=actor.id
    where membership.account_id=p_user_id and actor.id=p_actor_profile_id
    for share of actor;
    if not found then raise exception 'PROFILE_NOT_OWNED' using errcode='42501'; end if;
    select active_profile.type into v_current_type
    from public.accounts account
    join public.profiles active_profile on active_profile.id=account.current_profile_id
    where account.id=p_user_id;
    if v_current_type is not null and v_actor_type is distinct from v_current_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
    end if;
    select owner.type into v_owner_type
    from public.community_relationships owner_relation
    join public.profiles owner on owner.id=owner_relation.profile_id
    where owner_relation.community_id=p_target_id and owner_relation.type='owner'
    order by owner_relation.updated_at_ms asc limit 1
    for share of owner_relation,owner;
    if not found then
      if not exists(select 1 from public.communities community where community.id=p_target_id) then
        raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002';
      end if;
      raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002';
    end if;
    if v_actor_type is distinct from v_owner_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
    end if;
    select relation.type into v_role
    from public.community_relationships relation
    where relation.profile_id=p_actor_profile_id and relation.community_id=p_target_id
    for share;
    if v_role is distinct from 'owner' and v_role is distinct from 'moderator' then
      raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode='42501';
    end if;
  end if;

  insert into public.media_files(
    id,owner_user_id,purpose,bucket,path,content_type,expected_size,size,status,
    created_at_ms,completed_at_ms,expires_at_ms,resource_type,resource_id,
    message_from_profile_id,message_to_profile_id,deleting_at_ms,delete_after_ms
  ) values (
    p_id,p_user_id,p_purpose,p_bucket,p_path,p_content_type,p_expected_size,null,'pending',
    p_created_at_ms,null,null,null,null,null,null,null,null
  );
  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
end;
$function$;

create or replace function public.nexus_set_community_avatar(
  p_user_id uuid,
  p_community_id uuid,
  p_actor_profile_id uuid,
  p_upload_id uuid,
  p_picture text
)
returns table(previous_picture text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_current_type text;
  v_actor_type text;
  v_owner_profile_id uuid;
  v_owner_type text;
  v_role text;
  v_previous_picture text;
  v_now_ms bigint := floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint;
begin
  perform private.nexus_lock_collection_versions(
    array['accounts','profiles','communities','community_relationships','media_files']::text[]
  );
  select account.current_profile_id into v_current_profile_id
  from public.accounts account where account.id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  if not exists(select 1 from public.account_profiles membership
    where membership.account_id=p_user_id and membership.profile_id=p_actor_profile_id) then
    raise exception 'PROFILE_NOT_OWNED' using errcode='42501';
  end if;
  select profile.type into v_actor_type from public.profiles profile
  where profile.id=p_actor_profile_id for share;
  if not found then raise exception 'PROFILE_NOT_OWNED' using errcode='42501'; end if;
  if v_current_profile_id is not null then
    select profile.type into v_current_type from public.profiles profile
    where profile.id=v_current_profile_id;
    if v_current_type is not null and v_actor_type is distinct from v_current_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
    end if;
  end if;

  select community.picture into v_previous_picture from public.communities community
  where community.id=p_community_id for update;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  select relation.profile_id,owner.type into v_owner_profile_id,v_owner_type
  from public.community_relationships relation
  join public.profiles owner on owner.id=relation.profile_id
  where relation.community_id=p_community_id and relation.type='owner'
  order by relation.updated_at_ms asc limit 1
  for share of relation,owner;
  if not found then raise exception 'COMMUNITY_NOT_FOUND' using errcode='P0002'; end if;
  if v_actor_type is distinct from v_owner_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
  end if;
  select relation.type into v_role from public.community_relationships relation
  where relation.profile_id=p_actor_profile_id and relation.community_id=p_community_id
  for share;
  if v_role is distinct from 'owner' and v_role is distinct from 'moderator' then
    raise exception 'COMMUNITY_STAFF_REQUIRED' using errcode='42501';
  end if;

  if p_upload_id is not null then
    perform file.id from public.media_files file
    where file.id=p_upload_id and file.owner_user_id=p_user_id
      and file.purpose='community-avatar' and file.bucket='nexus-community-avatars'
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>v_now_ms-86400000
    for update;
    if not found then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
    if nullif(p_picture,'') is null then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
    update public.media_files set resource_type='community',resource_id=p_community_id
    where public.media_files.id=p_upload_id;
  end if;

  update public.communities set picture=coalesce(p_picture,'')
  where public.communities.id=p_community_id;
  perform private.nexus_bump_collection_versions(array['communities','media_files']::text[]);
  return query select v_previous_picture;
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
      and file.bucket='nexus-community-avatars' and file.path=p_avatar_path
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
  update public.profiles set last_activity_ms=greatest(public.profiles.last_activity_ms,p_created_at_ms)
  where public.profiles.id=p_owner_profile_id;
  if p_avatar_path is not null then
    update public.media_files set resource_type='community',resource_id=p_community_id
    where owner_user_id=p_user_id and purpose='community-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='community',resource_id=p_community_id,
    message_from_profile_id=null,message_to_profile_id=null where public.media_files.id=any(v_image_ids);
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
      and file.bucket='nexus-community-avatars' and file.path=p_avatar_path
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
    and (
      (public.media_files.purpose='editor-image' and not(public.media_files.id=any(v_image_ids)))
      or (public.media_files.purpose='community-avatar' and v_picture_changed)
    );
  update public.communities set name=btrim(p_name),url=p_url,picture=p_picture,about=p_about,
    type=v_profile_type,privacy=coalesce(p_privacy,v_community.privacy),
    last_activity_ms=greatest(public.communities.last_activity_ms,p_last_activity_ms)
  where public.communities.id=p_community_id
  returning public.communities.* into v_community;
  if v_picture_changed and p_avatar_path is not null then
    update public.media_files set resource_type='community',resource_id=p_community_id
    where owner_user_id=p_user_id and purpose='community-avatar'
      and bucket='nexus-avatars' and path=p_avatar_path;
  end if;
  update public.media_files set resource_type='community',resource_id=p_community_id,
    message_from_profile_id=null,message_to_profile_id=null where public.media_files.id=any(v_image_ids);
  perform private.nexus_bump_collection_versions(array['communities','media_files']::text[]);
  return query select v_community.id,v_community.name,v_community.url,v_community.picture,
    v_community.about,v_community.type,v_community.privacy,v_community.created_at_ms,
    v_community.last_activity_ms,case when v_picture_changed then v_previous_picture else null end;
end;
$function$;

create or replace function public.nexus_get_community_avatar(
  p_user_id uuid,
  p_id uuid
)
returns setof public.media_files
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_file public.media_files%rowtype;
  v_privacy text;
  v_community_type text;
begin
  select file.* into v_file
  from public.media_files file
  where file.id=p_id
  for share;

  if not found or v_file.purpose<>'community-avatar'
     or v_file.bucket<>'nexus-community-avatars'
     or v_file.status not in ('ready','deleting') then
    raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
  end if;

  if v_file.resource_type is null and v_file.resource_id is null then
    if v_file.status<>'ready' or p_user_id is distinct from v_file.owner_user_id then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
    return next v_file;
    return;
  end if;

  if v_file.resource_type<>'community' or v_file.resource_id is null then
    raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
  end if;

  select
    community.privacy,
    coalesce((
      select owner_profile.type
      from public.community_relationships owner_relation
      join public.profiles owner_profile on owner_profile.id=owner_relation.profile_id
      where owner_relation.community_id=community.id
        and owner_relation.type='owner'
      order by owner_relation.updated_at_ms,owner_relation.profile_id
      limit 1
    ),community.type)
  into v_privacy,v_community_type
  from public.communities community
  where community.id=v_file.resource_id;

  if not found or v_privacy is null or v_privacy not in ('public','unlisted','private') then
    raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
  end if;

  if v_privacy='private' then
    if p_user_id is null then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
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
        and relation.community_id=v_file.resource_id
        and relation.type in ('owner','moderator','connection')
        and member_profile.type=v_community_type
    ) then
      raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002';
    end if;
  end if;

  return next v_file;
end;
$function$;

create or replace function public.nexus_schedule_previous_community_avatar_deletion(
  p_id uuid,
  p_keep_id uuid,
  p_deleting_at_ms bigint,
  p_safe_age_ms bigint,
  p_lease_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_file public.media_files%rowtype;
  v_safe_from bigint;
begin
  if p_id is null or p_deleting_at_ms is null or p_safe_age_ms is null or p_lease_ms is null then
    raise exception 'INVALID_COMMUNITY_AVATAR_DELETION' using errcode='22023';
  end if;
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  select file.* into v_file
  from public.media_files file
  where file.id=p_id
    and file.purpose='community-avatar'
    and file.bucket='nexus-community-avatars'
  for update;

  if not found or v_file.id=p_keep_id then return; end if;

  if v_file.status='deleting'
     and coalesce(v_file.deleting_at_ms,0)>p_deleting_at_ms-300000 then
    return;
  end if;
  if v_file.status not in ('ready','deleting') then return; end if;

  v_safe_from:=coalesce(v_file.completed_at_ms,v_file.created_at_ms);
  update public.media_files
  set status='deleting',
      deleting_at_ms=p_deleting_at_ms,
      delete_after_ms=greatest(v_safe_from+p_safe_age_ms,p_deleting_at_ms+p_lease_ms)
  where id=p_id;

  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
end;
$function$;

revoke all on function public.nexus_get_community_avatar(uuid,uuid) from public,authenticated;
grant execute on function public.nexus_get_community_avatar(uuid,uuid) to anon;
revoke all on function public.nexus_schedule_previous_community_avatar_deletion(uuid,uuid,bigint,bigint,bigint) from public,authenticated;
grant execute on function public.nexus_schedule_previous_community_avatar_deletion(uuid,uuid,bigint,bigint,bigint) to anon;

notify pgrst,'reload schema';
commit;

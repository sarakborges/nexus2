create or replace function public.nexus_set_profile_avatar(
  p_user_id uuid,
  p_profile_id uuid,
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
  v_profile_type text;
  v_previous_picture text;
  v_now_ms bigint := floor(extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint;
begin
  perform private.nexus_lock_collection_versions(array['accounts','profiles','media_files']::text[]);
  select account.current_profile_id into v_current_profile_id
  from public.accounts account where account.id=p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002'; end if;
  if not exists(select 1 from public.account_profiles membership
    where membership.account_id=p_user_id and membership.profile_id=p_profile_id) then
    raise exception 'PROFILE_NOT_OWNED' using errcode='42501';
  end if;
  select profile.type,profile.picture into v_profile_type,v_previous_picture
  from public.profiles profile where profile.id=p_profile_id for update;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='P0002'; end if;
  if v_current_profile_id is not null then
    select profile.type into v_current_type
    from public.profiles profile where profile.id=v_current_profile_id;
    if v_current_type is not null and v_profile_type is distinct from v_current_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode='42501';
    end if;
  end if;

  if p_upload_id is not null then
    perform file.id from public.media_files file
    where file.id=p_upload_id and file.owner_user_id=p_user_id
      and file.purpose='profile-avatar' and file.bucket='nexus-avatars'
      and file.status='ready' and file.resource_type is null and file.resource_id is null
      and coalesce(file.completed_at_ms,file.created_at_ms)>v_now_ms-86400000
    for update;
    if not found then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
    if nullif(p_picture,'') is null then raise exception 'INVALID_AVATAR_UPLOAD' using errcode='22023'; end if;
    update public.media_files set resource_type='profile',resource_id=p_profile_id
    where public.media_files.id=p_upload_id;
  end if;

  update public.profiles set picture=coalesce(p_picture,'')
  where public.profiles.id=p_profile_id;
  perform private.nexus_bump_collection_versions(array['profiles','media_files']::text[]);
  return query select v_previous_picture;
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
      and file.purpose='community-avatar' and file.bucket='nexus-avatars'
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

revoke all on function public.nexus_set_profile_avatar(uuid,uuid,uuid,text) from public,authenticated;
revoke all on function public.nexus_set_community_avatar(uuid,uuid,uuid,uuid,text) from public,authenticated;
grant execute on function public.nexus_set_profile_avatar(uuid,uuid,uuid,text) to anon;
grant execute on function public.nexus_set_community_avatar(uuid,uuid,uuid,uuid,text) to anon;
notify pgrst,'reload schema';

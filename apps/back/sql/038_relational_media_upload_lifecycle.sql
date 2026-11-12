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
     or (p_purpose<>'editor-image' and p_bucket<>'nexus-avatars') then
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

create or replace function public.nexus_delete_pending_upload(p_user_id uuid,p_id uuid)
returns void
language plpgsql security invoker set search_path=''
as $function$
declare v_deleted integer;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  delete from public.media_files
  where id=p_id and owner_user_id=p_user_id and status='pending'
    and resource_type is null and resource_id is null;
  get diagnostics v_deleted=row_count;
  if v_deleted>0 then perform private.nexus_bump_collection_versions(array['media_files']::text[]); end if;
end;
$function$;

create or replace function public.nexus_complete_upload(
  p_user_id uuid,p_id uuid,p_size bigint,p_completed_at_ms bigint,
  p_expires_at_ms bigint,p_pending_max_age_ms bigint
)
returns setof public.media_files
language plpgsql security invoker set search_path=''
as $function$
declare v_file public.media_files%rowtype;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  select file.* into v_file from public.media_files file
  where file.id=p_id and file.owner_user_id=p_user_id for update;
  if not found then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
  if v_file.status='ready' then return next v_file; return; end if;
  if v_file.status<>'pending' then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
  if p_size is null or p_size<1 or p_completed_at_ms is null or p_pending_max_age_ms is null
     or v_file.created_at_ms+p_pending_max_age_ms<=p_completed_at_ms then
    raise exception 'UPLOAD_EXPIRED' using errcode='P0002';
  end if;
  update public.media_files file
  set size=p_size,status='ready',deleting_at_ms=null,delete_after_ms=null,
      completed_at_ms=p_completed_at_ms,expires_at_ms=p_expires_at_ms
  where file.id=p_id returning file.* into v_file;
  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  return next v_file;
end;
$function$;

create or replace function public.nexus_claim_expired_uploads(
  p_now_ms bigint,p_claim_lease_ms bigint,p_safe_age_ms bigint,
  p_orphan_avatar_retention_ms bigint,p_limit integer default 1000
)
returns setof public.media_files
language plpgsql security invoker set search_path=''
as $function$
begin
  if p_now_ms is null or p_claim_lease_ms is null or p_safe_age_ms is null
     or p_orphan_avatar_retention_ms is null or p_limit is null or p_limit<1 then
    raise exception 'INVALID_UPLOAD_CLEANUP_CLAIM' using errcode='22023';
  end if;
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  return query
  with candidates as (
    select file.id
    from public.media_files file
    where (
      (file.status='deleting'
        and coalesce(file.deleting_at_ms,0)<=p_now_ms-p_claim_lease_ms
        and (file.delete_after_ms is null or file.delete_after_ms<=p_now_ms))
      or (file.purpose='editor-image' and file.status='ready'
        and file.expires_at_ms is not null and file.expires_at_ms<=p_now_ms)
      or (file.status='pending' and file.created_at_ms+p_safe_age_ms<=p_now_ms)
      or (file.purpose<>'editor-image' and file.status='ready'
        and file.resource_type is null
        and coalesce(file.completed_at_ms,file.created_at_ms)+p_orphan_avatar_retention_ms<=p_now_ms)
    )
    order by file.created_at_ms,file.id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.media_files file
    set status='deleting',deleting_at_ms=p_now_ms,delete_after_ms=null
    from candidates
    where file.id=candidates.id
    returning file.*
  )
  select * from claimed;
  if found then perform private.nexus_bump_collection_versions(array['media_files']::text[]); end if;
end;
$function$;

create or replace function public.nexus_finish_upload_deletions(p_claims jsonb)
returns integer
language plpgsql security invoker set search_path=''
as $function$
declare v_deleted integer;
begin
  if p_claims is null or jsonb_typeof(p_claims)<>'array' then
    raise exception 'INVALID_UPLOAD_DELETION_CLAIMS' using errcode='22023';
  end if;
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  delete from public.media_files file
  using jsonb_to_recordset(p_claims) as claim(id uuid,deleting_at_ms bigint)
  where file.id=claim.id and file.status='deleting'
    and file.deleting_at_ms=claim.deleting_at_ms;
  get diagnostics v_deleted=row_count;
  if v_deleted>0 then perform private.nexus_bump_collection_versions(array['media_files']::text[]); end if;
  return v_deleted;
end;
$function$;

create or replace function public.nexus_schedule_upload_deletion(
  p_id uuid,p_user_id uuid,p_scheduled_at_ms bigint,p_allow_ready boolean,
  p_safe_age_ms bigint,p_lease_ms bigint
)
returns boolean
language plpgsql security invoker set search_path=''
as $function$
declare v_file public.media_files%rowtype; v_safe_from bigint;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  select file.* into v_file from public.media_files file where file.id=p_id for update;
  if not found or v_file.owner_user_id is distinct from p_user_id then return true; end if;
  if v_file.status='deleting' and v_file.delete_after_ms is not null then return true; end if;
  if v_file.status<>'pending' and not(p_allow_ready and v_file.status='ready') then return false; end if;
  if v_file.resource_type is not null then
    raise exception 'UPLOAD_ALREADY_ATTACHED' using errcode='42501';
  end if;
  v_safe_from:=case when v_file.status='ready'
    then coalesce(v_file.completed_at_ms,v_file.created_at_ms) else v_file.created_at_ms end;
  update public.media_files set status='deleting',deleting_at_ms=p_scheduled_at_ms,
    delete_after_ms=greatest(v_safe_from+p_safe_age_ms,p_scheduled_at_ms+p_lease_ms)
  where id=p_id;
  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  return true;
end;
$function$;

create or replace function public.nexus_claim_upload_deletion(
  p_id uuid,p_user_id uuid,p_deleting_at_ms bigint,p_expected_status text default null
)
returns setof public.media_files
language plpgsql security invoker set search_path=''
as $function$
declare v_file public.media_files%rowtype;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  select file.* into v_file from public.media_files file
  where file.id=p_id and file.owner_user_id=p_user_id for update;
  if not found then return; end if;
  if v_file.status='deleting' and coalesce(v_file.deleting_at_ms,0)>p_deleting_at_ms-300000 then return; end if;
  if p_expected_status is not null and v_file.status<>p_expected_status then return; end if;
  if v_file.resource_type is not null then
    raise exception 'UPLOAD_ALREADY_ATTACHED' using errcode='42501';
  end if;
  update public.media_files set status='deleting',deleting_at_ms=p_deleting_at_ms,delete_after_ms=null
  where id=p_id returning * into v_file;
  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
  return next v_file;
end;
$function$;

create or replace function public.nexus_schedule_previous_avatar_deletion(
  p_path text,p_keep_id uuid,p_deleting_at_ms bigint,p_safe_age_ms bigint,p_lease_ms bigint
)
returns void
language plpgsql security invoker set search_path=''
as $function$
declare v_file public.media_files%rowtype; v_safe_from bigint;
begin
  perform private.nexus_lock_collection_versions(array['media_files']::text[]);
  select file.* into v_file from public.media_files file
  where file.bucket='nexus-avatars' and file.path=p_path limit 1 for update;
  if not found or v_file.id=p_keep_id then return; end if;
  if v_file.status='deleting'
     and coalesce(v_file.deleting_at_ms,0)>p_deleting_at_ms-300000 then return; end if;
  v_safe_from:=coalesce(v_file.completed_at_ms,v_file.created_at_ms);
  update public.media_files set status='deleting',deleting_at_ms=p_deleting_at_ms,
    delete_after_ms=greatest(v_safe_from+p_safe_age_ms,p_deleting_at_ms+p_lease_ms)
  where id=v_file.id;
  perform private.nexus_bump_collection_versions(array['media_files']::text[]);
end;
$function$;

create or replace function public.nexus_get_editor_image(
  p_user_id uuid,p_id uuid,p_now_ms bigint
)
returns setof public.media_files
language plpgsql security invoker set search_path=''
as $function$
declare
  v_file public.media_files%rowtype;
  v_community_id uuid;
  v_privacy text;
  v_from uuid;
  v_to uuid;
begin
  select file.* into v_file from public.media_files file
  where file.id=p_id for share;
  if not found or v_file.purpose<>'editor-image' or v_file.status<>'ready'
     or (v_file.expires_at_ms is not null and v_file.expires_at_ms<=p_now_ms) then
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

  if v_file.resource_type in ('community','community-forum-topic','community-forum-reply') then
    v_community_id:=v_file.resource_id;
    if v_file.resource_type='community-forum-topic' then
      select topic.community_id into v_community_id
      from public.community_forum_topics topic where topic.id=v_file.resource_id;
    elsif v_file.resource_type='community-forum-reply' then
      select reply.community_id into v_community_id
      from public.community_forum_replies reply where reply.id=v_file.resource_id;
    end if;
    select community.privacy into v_privacy from public.communities community
    where community.id=v_community_id;
    if not found then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
    if v_privacy='private' then
      if p_user_id is null then raise exception 'UPLOAD_NOT_FOUND' using errcode='P0002'; end if;
      if not exists(select 1 from public.accounts account where account.id=p_user_id) then
        raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
      end if;
      if not exists(
        select 1 from public.account_profiles membership
        join public.community_relationships relation on relation.profile_id=membership.profile_id
        where membership.account_id=p_user_id and relation.community_id=v_community_id
          and relation.type in ('owner','moderator','connection')
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

revoke all on function public.nexus_create_upload(uuid,uuid,text,text,text,text,bigint,bigint,uuid,uuid) from public,authenticated;
revoke all on function public.nexus_delete_pending_upload(uuid,uuid) from public,authenticated;
revoke all on function public.nexus_complete_upload(uuid,uuid,bigint,bigint,bigint,bigint) from public,authenticated;
revoke all on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) from public,authenticated;
revoke all on function public.nexus_finish_upload_deletions(jsonb) from public,authenticated;
revoke all on function public.nexus_schedule_upload_deletion(uuid,uuid,bigint,boolean,bigint,bigint) from public,authenticated;
revoke all on function public.nexus_claim_upload_deletion(uuid,uuid,bigint,text) from public,authenticated;
revoke all on function public.nexus_schedule_previous_avatar_deletion(text,uuid,bigint,bigint,bigint) from public,authenticated;
revoke all on function public.nexus_get_editor_image(uuid,uuid,bigint) from public,authenticated;
grant execute on function public.nexus_create_upload(uuid,uuid,text,text,text,text,bigint,bigint,uuid,uuid) to anon;
grant execute on function public.nexus_delete_pending_upload(uuid,uuid) to anon;
grant execute on function public.nexus_complete_upload(uuid,uuid,bigint,bigint,bigint,bigint) to anon;
grant execute on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) to anon;
grant execute on function public.nexus_finish_upload_deletions(jsonb) to anon;
grant execute on function public.nexus_schedule_upload_deletion(uuid,uuid,bigint,boolean,bigint,bigint) to anon;
grant execute on function public.nexus_claim_upload_deletion(uuid,uuid,bigint,text) to anon;
grant execute on function public.nexus_schedule_previous_avatar_deletion(text,uuid,bigint,bigint,bigint) to anon;
grant execute on function public.nexus_get_editor_image(uuid,uuid,bigint) to anon;
notify pgrst,'reload schema';

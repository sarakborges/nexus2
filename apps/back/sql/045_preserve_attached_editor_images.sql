-- An editor image is temporary only while it is unattached. Once a content
-- record claims it, its upload retention deadline must stop governing it.
-- When an attachment is removed, restart the 24-hour orphan-cleanup window.
create or replace function private.nexus_manage_editor_image_expiry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if new.purpose = 'editor-image' then
    if new.resource_type is not null or new.resource_id is not null then
      new.expires_at_ms := null;
    elsif tg_op = 'UPDATE'
       and (old.resource_type is not null or old.resource_id is not null) then
      new.expires_at_ms :=
        floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint
        + 86400000;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function private.nexus_manage_editor_image_expiry() from public, anon, authenticated;
drop trigger if exists nexus_manage_editor_image_expiry on public.media_files;
create trigger nexus_manage_editor_image_expiry
before insert or update of purpose, resource_type, resource_id, expires_at_ms
on public.media_files
for each row execute function private.nexus_manage_editor_image_expiry();

-- Repair still-present attachments that already crossed the old 24-hour
-- deadline before the expiry lifecycle guard is installed.
update public.media_files
set expires_at_ms = null
where purpose = 'editor-image'
  and (resource_type is not null or resource_id is not null)
  and expires_at_ms is not null;

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
  if not found or v_file.purpose<>'editor-image' or v_file.status<>'ready'
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
    select community.privacy,community.type
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
        and (file.purpose<>'editor-image' or (file.resource_type is null and file.resource_id is null))
        and coalesce(file.deleting_at_ms,0)<=p_now_ms-p_claim_lease_ms
        and (file.delete_after_ms is null or file.delete_after_ms<=p_now_ms))
      or (file.purpose='editor-image' and file.status='ready'
        and file.resource_type is null and file.resource_id is null
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
 
revoke all on function public.nexus_get_editor_image(uuid,uuid,bigint) from public, authenticated;
grant execute on function public.nexus_get_editor_image(uuid,uuid,bigint) to anon;
revoke all on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) from public, authenticated;
grant execute on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) to anon;

notify pgrst, 'reload schema';

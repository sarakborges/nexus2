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
        and (
          file.purpose<>'editor-image'
          or (file.resource_type is null and file.resource_id is null)
          or not (
            case file.resource_type
              when 'profile' then exists (select 1 from public.profiles resource where resource.id=file.resource_id)
              when 'community' then exists (select 1 from public.communities resource where resource.id=file.resource_id)
              when 'profile-message' then exists (select 1 from public.profile_messages resource where resource.id=file.resource_id)
              when 'profile-post' then exists (select 1 from public.profile_posts resource where resource.id=file.resource_id)
              when 'community-forum-topic' then exists (select 1 from public.community_forum_topics resource where resource.id=file.resource_id)
              when 'community-forum-reply' then exists (select 1 from public.community_forum_replies resource where resource.id=file.resource_id)
              else false
            end
          )
        )
        and coalesce(file.deleting_at_ms,0)<=p_now_ms-p_claim_lease_ms
        and (file.delete_after_ms is null or file.delete_after_ms<=p_now_ms))
      or (file.purpose='editor-image' and file.status='ready'
        and file.resource_type is null and file.resource_id is null
        and file.expires_at_ms is not null and file.expires_at_ms<=p_now_ms)
      or (file.status='pending' and file.created_at_ms+p_safe_age_ms<=p_now_ms)
      or (file.status='ready' and file.purpose='editor-image' and (
        (file.resource_type='profile' and not exists (
          select 1 from public.profiles resource where resource.id=file.resource_id
        ))
        or (file.resource_type='community' and not exists (
          select 1 from public.communities resource where resource.id=file.resource_id
        ))
        or (file.resource_type='profile-message' and not exists (
          select 1 from public.profile_messages resource where resource.id=file.resource_id
        ))
        or (file.resource_type='profile-post' and not exists (
          select 1 from public.profile_posts resource where resource.id=file.resource_id
        ))
        or (file.resource_type='community-forum-topic' and not exists (
          select 1 from public.community_forum_topics resource where resource.id=file.resource_id
        ))
        or (file.resource_type='community-forum-reply' and not exists (
          select 1 from public.community_forum_replies resource where resource.id=file.resource_id
        ))
      ))
      or (file.status='ready' and file.purpose in ('profile-avatar','community-avatar')
        and (
          (file.purpose='profile-avatar' and file.resource_type='profile'
            and not exists (select 1 from public.profiles resource where resource.id=file.resource_id))
          or (file.purpose='community-avatar' and file.resource_type='community'
            and not exists (select 1 from public.communities resource where resource.id=file.resource_id))
        )
        and coalesce(file.completed_at_ms,file.created_at_ms)+p_orphan_avatar_retention_ms<=p_now_ms)
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
 
revoke all on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) from public, authenticated;
grant execute on function public.nexus_claim_expired_uploads(bigint,bigint,bigint,bigint,integer) to anon;

notify pgrst, 'reload schema';

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

revoke all on function public.nexus_get_editor_image(uuid,uuid,bigint) from public,authenticated;
grant execute on function public.nexus_get_editor_image(uuid,uuid,bigint) to anon;
notify pgrst,'reload schema';

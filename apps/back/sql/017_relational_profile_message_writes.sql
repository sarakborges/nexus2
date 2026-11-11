create or replace function public.nexus_send_profile_message(
  p_user_id uuid,
  p_message_id uuid,
  p_from_profile_id uuid,
  p_to_profile_id uuid,
  p_content text,
  p_created_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  from_profile_id uuid,
  to_profile_id uuid,
  content text,
  created_at_ms bigint,
  is_favorite boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_current_profile_id uuid;
  v_from_type text;
  v_to_type text;
  v_active_type text;
  v_message_audience text;
  v_expected_image_count integer;
  v_valid_image_count integer;
  v_pair_low uuid;
  v_pair_high uuid;
  v_plain_content text;
begin
  if p_user_id is null
     or p_message_id is null
     or p_from_profile_id is null
     or p_to_profile_id is null
     or p_from_profile_id = p_to_profile_id
     or p_content is null
     or p_created_at_ms is null
     or char_length(p_content) > 8000 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  v_plain_content := pg_catalog.btrim(
    pg_catalog.regexp_replace(p_content, '<[^>]*>', '', 'g')
  );

  if v_plain_content = ''
     and p_content !~* '<img\b'
     and cardinality(coalesce(p_image_ids, array[]::uuid[])) = 0 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  select account.current_profile_id
  into v_current_profile_id
  from public.accounts account
  where account.id = p_user_id
  for share;

  if not found then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_from_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select profile.type into v_from_type
  from public.profiles profile
  where profile.id = p_from_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  select profile.type into v_to_type
  from public.profiles profile
  where profile.id = p_to_profile_id
  for share;
  if not found then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_from_type <> v_to_type then
    raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
  end if;

  if v_current_profile_id is not null then
    select profile.type into v_active_type
    from public.profiles profile
    where profile.id = v_current_profile_id;

    if found and v_active_type <> v_from_type then
      raise exception 'PROFILE_TYPE_MISMATCH' using errcode = '42501';
    end if;
  end if;

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_to_profile_id;

  if found and v_message_audience = 'friends' then
    if not exists (
      select 1
      from public.account_profiles membership
      where membership.account_id = p_user_id
        and membership.profile_id = p_to_profile_id
    ) then
      v_pair_low := least(p_from_profile_id, p_to_profile_id);
      v_pair_high := greatest(p_from_profile_id, p_to_profile_id);

      if not exists (
        select 1 from public.relationships relationship
        where relationship.profile_id = v_pair_low
          and relationship.related_profile_id = v_pair_high
          and relationship.type = 'connection'
      ) then
        raise exception 'PROFILE_MESSAGE_FRIENDS_ONLY' using errcode = '42501';
      end if;
    end if;
  end if;

  v_expected_image_count := cardinality(coalesce(p_image_ids, array[]::uuid[]));
  if exists (
    select image_id
    from unnest(coalesce(p_image_ids, array[]::uuid[])) as image_id
    group by image_id
    having count(*) > 1
  ) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  perform file.id
  from public.media_files file
  where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
    and file.owner_user_id = p_user_id
    and file.purpose = 'editor-image'
    and file.status = 'ready'
    and (file.expires_at_ms is null or file.expires_at_ms > p_created_at_ms)
  for update;

  get diagnostics v_valid_image_count = row_count;
  if v_valid_image_count <> v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.media_files file
    where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
      and (file.resource_type is not null or file.resource_id is not null)
  ) then
    raise exception 'EDITOR_IMAGE_ALREADY_ATTACHED' using errcode = '22023';
  end if;

  insert into public.profile_messages (
    id, from_profile_id, to_profile_id, content, created_at_ms, is_favorite
  )
  values (
    p_message_id, p_from_profile_id, p_to_profile_id, p_content, p_created_at_ms, false
  );

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where id in (p_from_profile_id, p_to_profile_id);

  update public.media_files
  set resource_type = 'profile-message',
      resource_id = p_message_id,
      message_from_profile_id = p_from_profile_id,
      message_to_profile_id = p_to_profile_id
  where id = any(coalesce(p_image_ids, array[]::uuid[]));

  return query
  select message.id, message.from_profile_id, message.to_profile_id,
    message.content, message.created_at_ms, message.is_favorite
  from public.profile_messages message
  where message.id = p_message_id;
end;
$function$;

create or replace function public.nexus_delete_profile_message(
  p_user_id uuid,
  p_recipient_profile_id uuid,
  p_message_id uuid,
  p_actor_profile_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_from_profile_id uuid;
  v_to_profile_id uuid;
begin
  if p_user_id is null or p_recipient_profile_id is null
     or p_message_id is null or p_actor_profile_id is null then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select message.from_profile_id, message.to_profile_id
  into v_from_profile_id, v_to_profile_id
  from public.profile_messages message
  where message.id = p_message_id
    and message.to_profile_id = p_recipient_profile_id
  for update;

  if not found then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_actor_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  if p_actor_profile_id <> v_from_profile_id
     and p_actor_profile_id <> v_to_profile_id then
    raise exception 'PROFILE_MESSAGE_DELETE_NOT_ALLOWED' using errcode = '42501';
  end if;

  update public.media_files
  set resource_type = null,
      resource_id = null,
      message_from_profile_id = null,
      message_to_profile_id = null
  where owner_user_id = p_user_id
    and resource_type = 'profile-message'
    and resource_id = p_message_id;

  delete from public.profile_messages
  where id = p_message_id
    and to_profile_id = p_recipient_profile_id;
end;
$function$;

create or replace function public.nexus_set_profile_message_favorite(
  p_user_id uuid,
  p_recipient_profile_id uuid,
  p_message_id uuid,
  p_actor_profile_id uuid,
  p_is_favorite boolean
)
returns table (
  id uuid,
  from_profile_id uuid,
  to_profile_id uuid,
  content text,
  created_at_ms bigint,
  is_favorite boolean
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_user_id is null or p_recipient_profile_id is null
     or p_message_id is null or p_actor_profile_id is null
     or p_is_favorite is null then
    raise exception 'PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_actor_profile_id <> p_recipient_profile_id
     or not exists (
       select 1 from public.account_profiles membership
       where membership.account_id = p_user_id
         and membership.profile_id = p_recipient_profile_id
     ) then
    raise exception 'PROFILE_MESSAGE_FAVORITE_NOT_ALLOWED' using errcode = '42501';
  end if;

  return query
  update public.profile_messages message
  set is_favorite = p_is_favorite
  where message.id = p_message_id
    and message.to_profile_id = p_recipient_profile_id
  returning message.id, message.from_profile_id, message.to_profile_id,
    message.content, message.created_at_ms, message.is_favorite;

  if not found then
    raise exception 'PROFILE_MESSAGE_NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$function$;

revoke all on function public.nexus_send_profile_message(uuid, uuid, uuid, uuid, text, bigint, uuid[]) from public, authenticated;
revoke all on function public.nexus_delete_profile_message(uuid, uuid, uuid, uuid) from public, authenticated;
revoke all on function public.nexus_set_profile_message_favorite(uuid, uuid, uuid, uuid, boolean) from public, authenticated;
grant execute on function public.nexus_send_profile_message(uuid, uuid, uuid, uuid, text, bigint, uuid[]) to anon;
grant execute on function public.nexus_delete_profile_message(uuid, uuid, uuid, uuid) to anon;
grant execute on function public.nexus_set_profile_message_favorite(uuid, uuid, uuid, uuid, boolean) to anon;

notify pgrst, 'reload schema';
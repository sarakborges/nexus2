create or replace function public.nexus_get_profile_settings(
  p_user_id uuid,
  p_profile_id uuid
)
returns table (
  message_audience text,
  publish_activity_types text[],
  show_friend_activity_types text[]
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_has_settings boolean;
  v_message_audience text;
  v_publish_activity_types text[];
  v_show_friend_activity_types text[];
  v_default_activity_types text[] := array[
    'friend_connected', 'profile_post', 'community_created', 'community_membership'
  ]::text[];
begin
  if p_user_id is null or p_profile_id is null then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_profile_id;

  v_has_settings := found;

  if not v_has_settings then
    v_message_audience := 'everyone';
    v_publish_activity_types := v_default_activity_types;
    v_show_friend_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_publish_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.publish_activity = true
    );

    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_show_friend_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.show_friend_activity = true
    );
  end if;

  return query
  select
    coalesce(v_message_audience, 'everyone'),
    coalesce(v_publish_activity_types, array[]::text[]),
    coalesce(v_show_friend_activity_types, array[]::text[]);
end;
$function$;

create or replace function public.nexus_update_profile_settings(
  p_user_id uuid,
  p_profile_id uuid,
  p_patch jsonb
)
returns table (
  message_audience text,
  publish_activity_types text[],
  show_friend_activity_types text[]
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_has_settings boolean;
  v_message_audience text;
  v_publish_activity_types text[];
  v_show_friend_activity_types text[];
  v_default_activity_types text[] := array[
    'friend_connected', 'profile_post', 'community_created', 'community_membership'
  ]::text[];
begin
  if p_user_id is null or p_profile_id is null
     or p_patch is null
     or pg_catalog.jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'INVALID_PROFILE_SETTINGS_PATCH' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts account where account.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles profile where profile.id = p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_profile_id::text, 0::bigint)
  );

  select settings.message_audience
  into v_message_audience
  from public.profile_settings settings
  where settings.profile_id = p_profile_id
  for update;

  v_has_settings := found;

  if p_patch ? 'messageAudience' then
    v_message_audience := case
      when p_patch ->> 'messageAudience' = 'friends' then 'friends'
      else 'everyone'
    end;
  elsif not v_has_settings then
    v_message_audience := 'everyone';
  else
    v_message_audience := coalesce(v_message_audience, 'everyone');
  end if;

  if p_patch ? 'publishActivityTypes' then
    if pg_catalog.jsonb_typeof(p_patch -> 'publishActivityTypes') = 'array' then
      select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
      into v_publish_activity_types
      from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
      where exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(p_patch -> 'publishActivityTypes') as requested(activity_type)
        where requested.activity_type = activity.activity_type
      );
    else
      v_publish_activity_types := v_default_activity_types;
    end if;
  elsif not v_has_settings then
    v_publish_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_publish_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.publish_activity = true
    );
  end if;

  if p_patch ? 'showFriendActivityTypes' then
    if pg_catalog.jsonb_typeof(p_patch -> 'showFriendActivityTypes') = 'array' then
      select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
      into v_show_friend_activity_types
      from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
      where exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(p_patch -> 'showFriendActivityTypes') as requested(activity_type)
        where requested.activity_type = activity.activity_type
      );
    else
      v_show_friend_activity_types := v_default_activity_types;
    end if;
  elsif not v_has_settings then
    v_show_friend_activity_types := v_default_activity_types;
  else
    select coalesce(array_agg(activity.activity_type order by activity.position), array[]::text[])
    into v_show_friend_activity_types
    from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
    where exists (
      select 1 from public.profile_activity_preferences preference
      where preference.profile_id = p_profile_id
        and preference.activity_type = activity.activity_type
        and preference.show_friend_activity = true
    );
  end if;

  insert into public.profile_settings (profile_id, message_audience)
  values (p_profile_id, v_message_audience)
  on conflict (profile_id) do update
  set message_audience = excluded.message_audience;

  insert into public.profile_activity_preferences (
    profile_id, activity_type, publish_activity, show_friend_activity
  )
  select
    p_profile_id,
    activity.activity_type,
    activity.activity_type = any(v_publish_activity_types),
    activity.activity_type = any(v_show_friend_activity_types)
  from unnest(v_default_activity_types) with ordinality as activity(activity_type, position)
  on conflict (profile_id, activity_type) do update
  set publish_activity = excluded.publish_activity,
      show_friend_activity = excluded.show_friend_activity;

  return query
  select
    v_message_audience,
    v_publish_activity_types,
    v_show_friend_activity_types;
end;
$function$;

revoke all on function public.nexus_get_profile_settings(uuid, uuid) from public, authenticated;
revoke all on function public.nexus_update_profile_settings(uuid, uuid, jsonb) from public, authenticated;
grant execute on function public.nexus_get_profile_settings(uuid, uuid) to anon;
grant execute on function public.nexus_update_profile_settings(uuid, uuid, jsonb) to anon;

notify pgrst, 'reload schema';
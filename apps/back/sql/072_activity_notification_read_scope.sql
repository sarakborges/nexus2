-- Validate notification read-state IDs against the full feed visibility rules.
-- Do not restrict callers to the first 51 rows of the paginated activity feed.
begin;

create or replace function private.nexus_visible_activity_ids_for_account(
  p_user_id uuid,
  p_activity_ids text[]
)
returns table (activity_id text)
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_user_id is null then
    raise exception 'ACTIVITY_READ_USER_REQUIRED' using errcode = '22023';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return;
  end if;

  return query
  with account_context as (
    select
      account.id as account_id,
      case when exists (
        select 1
        from public.account_profiles active_membership
        where active_membership.account_id = account.id
          and active_membership.profile_id = account.current_profile_id
          and active_membership.deleted_at_ms is null
      ) then account.current_profile_id end as active_profile_id
    from public.accounts account
    where account.id = p_user_id
      and account.deleted_at_ms is null
  ),
  account_owned_profiles as (
    select profile.id as profile_id, profile.type
    from public.account_profiles membership
    join public.profiles profile on profile.id = membership.profile_id
    where membership.account_id = p_user_id
      and membership.deleted_at_ms is null
      and profile.deleted_at_ms is null
  ),
  owned_profiles as (
    select profile.id as profile_id, profile.type
    from public.account_profiles membership
    join public.profiles profile on profile.id = membership.profile_id
    cross join account_context context
    where membership.account_id = p_user_id
      and membership.profile_id = context.active_profile_id
      and membership.deleted_at_ms is null
      and profile.deleted_at_ms is null
  ),
  friend_profiles as (
    select distinct
      case
        when active_profile.id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end as profile_id
    from public.relationships relationship
    cross join account_context context
    join public.profiles active_profile
      on active_profile.id = context.active_profile_id
     and active_profile.deleted_at_ms is null
    join public.profiles friend_profile
      on friend_profile.id = case
        when active_profile.id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end
     and friend_profile.deleted_at_ms is null
    where relationship.type = 'connection'
      and relationship.deleted_at_ms is null
      and active_profile.id in (relationship.profile_id, relationship.related_profile_id)
      and friend_profile.type = active_profile.type
      and not exists (
        select 1
        from account_owned_profiles already_owned
        where already_owned.profile_id = friend_profile.id
      )
  ),
  visible_profiles as (
    select profile_id from owned_profiles
    union
    select profile_id from friend_profiles
  ),
  feed_events as (
    select
      activity.*,
      case
        when activity.type = 'friend_connected'
          and exists (
            select 1
            from owned_profiles owned
            where owned.profile_id = activity.actor_profile_id
          )
          then activity.actor_profile_id
        when activity.type = 'friend_connected'
          then activity.target_profile_id
        else activity.actor_profile_id
      end as viewer_profile_id,
      case
        when activity.type = 'friend_connected'
          and exists (
            select 1
            from owned_profiles owned
            where owned.profile_id = activity.actor_profile_id
          )
          then activity.target_profile_id
        when activity.type = 'friend_connected'
          then activity.actor_profile_id
        else null
      end as friend_profile_id
    from public.feed_activities activity
    where activity.deleted_at_ms is null
      and activity.id = any(coalesce(p_activity_ids, array[]::text[]))
  )
  select event.id
  from feed_events event
  cross join account_context context
  join public.profiles actor
    on actor.id = event.viewer_profile_id
   and actor.deleted_at_ms is null
  left join public.profiles friend
    on friend.id = event.friend_profile_id
   and friend.deleted_at_ms is null
  left join public.communities community
    on community.id = event.community_id
   and community.deleted_at_ms is null
  left join public.profile_posts post
    on post.id = event.profile_post_id
   and post.profile_id = actor.id
   and post.deleted_at_ms is null
  where
    (
      (
        event.type = 'friend_connected'
        and exists (
          select 1
          from owned_profiles owned
          where owned.profile_id = event.viewer_profile_id
        )
        and not exists (
          select 1
          from owned_profiles owned
          where owned.profile_id = event.friend_profile_id
        )
        and friend.id is not null
        and friend.type = actor.type
      )
      or
      (
        event.type <> 'friend_connected'
        and exists (
          select 1
          from visible_profiles visible
          where visible.profile_id = actor.id
        )
      )
    )
    and (
      not exists (
        select 1
        from public.profile_settings publisher_settings
        where publisher_settings.profile_id = actor.id
          and publisher_settings.deleted_at_ms is null
      )
      or exists (
        select 1
        from public.profile_activity_preferences publisher_preference
        where publisher_preference.profile_id = actor.id
          and publisher_preference.activity_type = event.type
          and publisher_preference.publish_activity = true
          and publisher_preference.deleted_at_ms is null
      )
    )
    and (
      (
        event.type <> 'friend_connected'
        and exists (
          select 1
          from owned_profiles owned
          where owned.profile_id = actor.id
        )
      )
      or not exists (
        select 1
        from public.profile_settings viewer_settings
        where viewer_settings.profile_id = context.active_profile_id
          and viewer_settings.deleted_at_ms is null
      )
      or exists (
        select 1
        from public.profile_activity_preferences viewer_preference
        where viewer_preference.profile_id = context.active_profile_id
          and viewer_preference.activity_type = event.type
          and viewer_preference.show_friend_activity = true
          and viewer_preference.deleted_at_ms is null
      )
    )
    and (
      event.type not in ('community_created', 'community_membership')
      or (
        community.id is not null
        and community.type = actor.type
        and (
          exists (
            select 1
            from owned_profiles owned
            where owned.profile_id = actor.id
          )
          or community.privacy = 'public'
        )
      )
    )
    and (
      event.type <> 'profile_post'
      or post.id is not null
    );
end;
$function$;

create or replace function public.nexus_mark_activities_read(
  p_user_id uuid,
  p_activity_ids text[],
  p_read_at_ms bigint
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_count integer := 0;
begin
  if not private.nexus_server_request_authorized() then
    raise exception 'SERVER_REQUEST_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_user_id is null or p_read_at_ms is null
     or coalesce(cardinality(p_activity_ids), 0) > 50 then
    raise exception 'ACTIVITY_READ_INPUT_INVALID' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.accounts account
    where account.id = p_user_id
      and account.deleted_at_ms is null
  ) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if coalesce(cardinality(p_activity_ids), 0) = 0 then
    return 0;
  end if;

  insert into public.activity_notification_reads (account_id, activity_id, read_at_ms)
  select p_user_id, visible.activity_id, p_read_at_ms
  from private.nexus_visible_activity_ids_for_account(p_user_id, p_activity_ids) visible
  on conflict (account_id, activity_id) do update
    set read_at_ms = excluded.read_at_ms,
        deleted_at_ms = null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function private.nexus_visible_activity_ids_for_account(uuid, text[])
  from public, authenticated;
grant execute on function private.nexus_visible_activity_ids_for_account(uuid, text[])
  to anon;

revoke all on function public.nexus_mark_activities_read(uuid, text[], bigint)
  from public, authenticated;
grant execute on function public.nexus_mark_activities_read(uuid, text[], bigint)
  to anon;

notify pgrst, 'reload schema';

commit;

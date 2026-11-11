create or replace function public.nexus_get_activity_feed_page(
  p_user_id uuid,
  p_limit integer default 10,
  p_cursor_updated_at_ms bigint default null,
  p_cursor_id text default null
)
returns table (
  id text,
  type text,
  updated_at_ms bigint,
  profile jsonb,
  friend jsonb,
  community jsonb,
  content text,
  role text
)
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_user_id is null then
    raise exception 'ACTIVITY_FEED_USER_REQUIRED' using errcode = '22023';
  end if;

  if (p_cursor_updated_at_ms is null) <> (p_cursor_id is null) then
    raise exception 'ACTIVITY_FEED_CURSOR_INVALID' using errcode = '22023';
  end if;

  if not exists (select 1 from public.accounts a where a.id = p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  return query
  with account_context as (
    select
      a.id as account_id,
      coalesce(
        case when exists (
          select 1 from public.account_profiles active_membership
          where active_membership.account_id = a.id
            and active_membership.profile_id = a.current_profile_id
        ) then a.current_profile_id end,
        (
          select ap.profile_id
          from public.account_profiles ap
          where ap.account_id = a.id
          order by ap.position asc
          limit 1
        )
      ) as active_profile_id
    from public.accounts a
    where a.id = p_user_id
  ),
  owned_profiles as (
    select p.id as profile_id, p.type
    from public.account_profiles ap
    join public.profiles p on p.id = ap.profile_id
    where ap.account_id = p_user_id
  ),
  friend_profiles as (
    select distinct
      case
        when owned.profile_id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end as profile_id
    from public.relationships relationship
    join owned_profiles owned
      on owned.profile_id = relationship.profile_id
      or owned.profile_id = relationship.related_profile_id
    join public.profiles friend_profile
      on friend_profile.id = case
        when owned.profile_id = relationship.profile_id then relationship.related_profile_id
        else relationship.profile_id
      end
    where relationship.type = 'connection'
      and friend_profile.type = owned.type
      and not exists (
        select 1 from owned_profiles already_owned
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
            select 1 from owned_profiles owned
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
            select 1 from owned_profiles owned
            where owned.profile_id = activity.actor_profile_id
          )
          then activity.target_profile_id
        when activity.type = 'friend_connected'
          then activity.actor_profile_id
        else null
      end as friend_profile_id
    from public.feed_activities activity
  )
  select
    event.id,
    event.type,
    event.updated_at_ms,
    jsonb_build_object(
      'id', actor.id,
      'name', actor.name,
      'url', actor.url,
      'picture', actor.picture,
      'about', actor.about,
      'type', actor.type,
      'createdAt', actor.created_at_ms,
      'lastActivity', actor.last_activity_ms
    ) as profile,
    case when friend.id is null then null else jsonb_build_object(
      'id', friend.id,
      'name', friend.name,
      'url', friend.url,
      'picture', friend.picture,
      'about', friend.about,
      'type', friend.type,
      'createdAt', friend.created_at_ms,
      'lastActivity', friend.last_activity_ms
    ) end as friend,
    case when community.id is null then null else jsonb_build_object(
      'id', community.id,
      'name', community.name,
      'url', community.url,
      'picture', community.picture,
      'about', community.about,
      'type', community.type,
      'privacy', community.privacy,
      'createdAt', community.created_at_ms,
      'lastActivity', community.last_activity_ms
    ) end as community,
    post.content,
    event.role
  from feed_events event
  cross join account_context context
  join public.profiles actor on actor.id = event.viewer_profile_id
  left join public.profiles friend on friend.id = event.friend_profile_id
  left join public.communities community on community.id = event.community_id
  left join public.profile_posts post
    on post.id = event.profile_post_id
   and post.profile_id = actor.id
  where
    (
      (
        event.type = 'friend_connected'
        and exists (
          select 1 from owned_profiles owned
          where owned.profile_id = event.viewer_profile_id
        )
        and not exists (
          select 1 from owned_profiles owned
          where owned.profile_id = event.friend_profile_id
        )
        and friend.id is not null
        and friend.type = actor.type
      )
      or
      (
        event.type <> 'friend_connected'
        and exists (
          select 1 from visible_profiles visible
          where visible.profile_id = actor.id
        )
      )
    )
    and (
      not exists (
        select 1 from public.profile_settings publisher_settings
        where publisher_settings.profile_id = actor.id
      )
      or exists (
        select 1
        from public.profile_activity_preferences publisher_preference
        where publisher_preference.profile_id = actor.id
          and publisher_preference.activity_type = event.type
          and publisher_preference.publish_activity = true
      )
    )
    and (
      (
        event.type <> 'friend_connected'
        and exists (
          select 1 from owned_profiles owned
          where owned.profile_id = actor.id
        )
      )
      or not exists (
        select 1
        from public.profile_settings viewer_settings
        where viewer_settings.profile_id = context.active_profile_id
      )
      or exists (
        select 1
        from public.profile_activity_preferences viewer_preference
        where viewer_preference.profile_id = context.active_profile_id
          and viewer_preference.activity_type = event.type
          and viewer_preference.show_friend_activity = true
      )
    )
    and (
      event.type not in ('community_created', 'community_membership')
      or (
        community.id is not null
        and community.type = actor.type
        and (
          exists (
            select 1 from owned_profiles owned
            where owned.profile_id = actor.id
          )
          or community.privacy = 'public'
        )
      )
    )
    and (
      event.type <> 'profile_post'
      or post.id is not null
    )
    and (
      p_cursor_updated_at_ms is null
      or event.updated_at_ms < p_cursor_updated_at_ms
      or (
        event.updated_at_ms = p_cursor_updated_at_ms
        and event.id > p_cursor_id
      )
    )
  order by event.updated_at_ms desc, event.id asc
  limit least(greatest(coalesce(p_limit, 10), 1), 50) + 1;
end;
$function$;

revoke all on function public.nexus_get_activity_feed_page(uuid, integer, bigint, text) from public, authenticated;
grant execute on function public.nexus_get_activity_feed_page(uuid, integer, bigint, text) to anon;

notify pgrst, 'reload schema';

create or replace function public.nexus_get_profile_messages_page(
  p_url text,
  p_user_id uuid default null,
  p_page integer default 1,
  p_query text default null,
  p_sort text default 'activity-desc',
  p_message_tab text default 'all'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_profile public.profiles%rowtype;
  v_account public.accounts%rowtype;
  v_owned_profile_ids uuid[] := array[]::uuid[];
  v_current_profile_id uuid;
  v_current_profile_type text;
  v_viewer_relationship jsonb;
  v_is_owner boolean := false;
  v_message_tab text := 'all';
  v_search text := private.nexus_forum_search_text(p_query);
  v_sort text := coalesce(p_sort, 'activity-desc');
  v_total_items bigint := 0;
  v_total_pages integer := 1;
  v_page integer := 1;
  v_messages jsonb := '[]'::jsonb;
  v_sender_ids uuid[] := array[]::uuid[];
  v_senders jsonb := '[]'::jsonb;
  v_permissions jsonb := '{}'::jsonb;
  v_page_message_ids uuid[] := array[]::uuid[];
  v_profile_json jsonb;
begin
  if p_url is null or pg_catalog.btrim(p_url) = '' then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_sort not in ('activity-desc','activity-asc','name-asc','name-desc') then
    v_sort := 'activity-desc';
  end if;

  if p_user_id is not null then
    select account.*
    into v_account
    from public.accounts account
    where account.id = p_user_id;
    if not found then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    select coalesce(array_agg(membership.profile_id order by membership.position), array[]::uuid[])
    into v_owned_profile_ids
    from public.account_profiles membership
    where membership.account_id = p_user_id;

    if v_account.current_profile_id = any(v_owned_profile_ids) then
      v_current_profile_id := v_account.current_profile_id;
      select profile.type into v_current_profile_type
      from public.profiles profile
      where profile.id = v_current_profile_id;
    end if;
  end if;

  select profile.*
  into v_profile
  from public.profiles profile
  where profile.url = p_url
  limit 1;

  if not found then
    return pg_catalog.jsonb_build_object(
      'profile', null,
      'viewerRelationship', null,
      'currentProfileType', v_current_profile_type,
      'isProfileOwner', false,
      'messageTab', 'all',
      'messages', pg_catalog.jsonb_build_object(
        'items', '[]'::jsonb, 'page', 1, 'pageSize', 20,
        'totalItems', 0, 'totalPages', 1
      ),
      'senders', '[]'::jsonb,
      'messagePermissions', '{}'::jsonb
    );
  end if;

  v_is_owner := v_profile.id = any(v_owned_profile_ids);
  if v_is_owner and p_message_tab = 'favorites' then
    v_message_tab := 'favorites';
  end if;

  if v_current_profile_id is not null and v_current_profile_id <> v_profile.id then
    select pg_catalog.jsonb_build_object(
      'profiles', pg_catalog.jsonb_build_array(relationship.profile_id, relationship.related_profile_id),
      'type', relationship.type,
      'requestedBy', relationship.requested_by,
      'blockedBy', relationship.blocked_by,
      'updatedAt', relationship.updated_at_ms
    )
    into v_viewer_relationship
    from public.relationships relationship
    where relationship.profile_id = least(v_current_profile_id, v_profile.id)
      and relationship.related_profile_id = greatest(v_current_profile_id, v_profile.id)
    limit 1;
  end if;

  select count(*)::bigint
  into v_total_items
  from public.profile_messages message
  left join public.profiles sender
    on sender.id = message.from_profile_id
  where message.to_profile_id = v_profile.id
    and (v_is_owner or message.from_profile_id = any(v_owned_profile_ids))
    and (v_message_tab <> 'favorites' or message.is_favorite = true)
    and (
      v_search = ''
      or pg_catalog.strpos(
        private.nexus_forum_search_text(
          message.content || ' ' || coalesce(sender.name, '') || ' ' || coalesce(sender.url, '')
        ),
        v_search
      ) > 0
    );

  v_total_pages := greatest(1, pg_catalog.ceil(v_total_items::numeric / 20)::integer);
  v_page := least(greatest(coalesce(p_page, 1), 1), v_total_pages);

  select
    coalesce(array_agg(page_rows.id), array[]::uuid[]),
    coalesce(array_agg(distinct page_rows.from_profile_id), array[]::uuid[]),
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', page_rows.id,
          'fromProfileId', page_rows.from_profile_id,
          'toProfileId', page_rows.to_profile_id,
          'content', page_rows.content,
          'createdAt', page_rows.created_at_ms,
          'isFavorite', coalesce(page_rows.is_favorite, false)
        )
        order by
          case when v_sort = 'activity-asc' then page_rows.created_at_ms end asc,
          case when v_sort = 'activity-desc' then page_rows.created_at_ms end desc,
          case when v_sort = 'name-asc' then pg_catalog.lower(page_rows.sender_name) end asc,
          case when v_sort = 'name-desc' then pg_catalog.lower(page_rows.sender_name) end desc,
          page_rows.id asc
      ),
      '[]'::jsonb
    )
  into v_page_message_ids, v_sender_ids, v_messages
  from (
    select message.*, coalesce(sender.name, '') as sender_name
    from public.profile_messages message
    left join public.profiles sender
      on sender.id = message.from_profile_id
    where message.to_profile_id = v_profile.id
      and (v_is_owner or message.from_profile_id = any(v_owned_profile_ids))
      and (v_message_tab <> 'favorites' or message.is_favorite = true)
      and (
        v_search = ''
        or pg_catalog.strpos(
          private.nexus_forum_search_text(
            message.content || ' ' || coalesce(sender.name, '') || ' ' || coalesce(sender.url, '')
          ),
          v_search
        ) > 0
      )
    order by
      case when v_sort = 'activity-asc' then message.created_at_ms end asc,
      case when v_sort = 'activity-desc' then message.created_at_ms end desc,
      case when v_sort = 'name-asc' then pg_catalog.lower(coalesce(sender.name, '')) end asc,
      case when v_sort = 'name-desc' then pg_catalog.lower(coalesce(sender.name, '')) end desc,
      message.id asc
    offset ((v_page - 1) * 20)
    limit 20
  ) page_rows;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', sender.id,
        'name', sender.name,
        'url', sender.url,
        'picture', sender.picture,
        'about', sender.about,
        'type', sender.type,
        'createdAt', sender.created_at_ms,
        'lastActivity', sender.last_activity_ms
      )
      order by sender.id
    ),
    '[]'::jsonb
  )
  into v_senders
  from public.profiles sender
  where sender.id = any(v_sender_ids);

  select coalesce(
    pg_catalog.jsonb_object_agg(
      message.id::text,
      pg_catalog.jsonb_build_object(
        'canDelete', v_is_owner or message.from_profile_id = any(v_owned_profile_ids),
        'canFavorite', v_is_owner,
        'canReply',
          v_is_owner
          and v_current_profile_id is not null
          and v_current_profile_type = v_profile.type
          and message.from_profile_id <> v_profile.id
      )
    ),
    '{}'::jsonb
  )
  into v_permissions
  from public.profile_messages message
  where message.id = any(v_page_message_ids);

  v_profile_json := pg_catalog.jsonb_build_object(
    'id', v_profile.id,
    'name', v_profile.name,
    'url', v_profile.url,
    'picture', v_profile.picture,
    'about', v_profile.about,
    'type', v_profile.type,
    'createdAt', v_profile.created_at_ms,
    'lastActivity', v_profile.last_activity_ms
  );

  return pg_catalog.jsonb_build_object(
    'profile', v_profile_json,
    'viewerRelationship', v_viewer_relationship,
    'currentProfileType', v_current_profile_type,
    'isProfileOwner', v_is_owner,
    'messageTab', v_message_tab,
    'messages', pg_catalog.jsonb_build_object(
      'items', v_messages,
      'page', v_page,
      'pageSize', 20,
      'totalItems', v_total_items,
      'totalPages', v_total_pages
    ),
    'senders', v_senders,
    'messagePermissions', v_permissions
  );
end;
$function$;

revoke all on function public.nexus_get_profile_messages_page(text,uuid,integer,text,text,text) from public, authenticated;
grant execute on function public.nexus_get_profile_messages_page(text,uuid,integer,text,text,text) to anon;
notify pgrst, 'reload schema';
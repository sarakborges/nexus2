create or replace function public.nexus_get_community_forum_topics(
  p_community_id uuid,
  p_user_id uuid default null,
  p_page integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  community_url text;
  page_result jsonb;
begin
  select c.url into community_url
  from public.communities c
  where c.id = p_community_id;
  if not found then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  page_result := public.nexus_get_community_forum_page(
    community_url, p_user_id, p_page, null, 'activity-desc'
  );

  if coalesce((page_result->>'canReadForum')::boolean,false) is false then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  return page_result->'topics';
end;
$function$;

create or replace function public.nexus_get_community_forum_topic(
  p_community_id uuid,
  p_topic_id uuid,
  p_user_id uuid default null,
  p_page integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  community_url text;
  page_result jsonb;
begin
  select c.url into community_url
  from public.communities c
  where c.id = p_community_id;
  if not found then
    raise exception 'COMMUNITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  page_result := public.nexus_get_community_forum_topic_page(
    community_url, p_topic_id, p_user_id, p_page, null, 'activity-asc'
  );

  return page_result->'detail';
end;
$function$;

revoke all on function public.nexus_get_community_forum_topics(uuid,uuid,integer) from public,authenticated;
grant execute on function public.nexus_get_community_forum_topics(uuid,uuid,integer) to anon;
revoke all on function public.nexus_get_community_forum_topic(uuid,uuid,uuid,integer) from public,authenticated;
grant execute on function public.nexus_get_community_forum_topic(uuid,uuid,uuid,integer) to anon;

notify pgrst,'reload schema';
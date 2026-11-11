create or replace function public.nexus_get_profile_messages(
  p_profile_id uuid,
  p_user_id uuid default null,
  p_page integer default 1
)
returns table (
  id uuid,
  from_profile_id uuid,
  to_profile_id uuid,
  content text,
  created_at_ms bigint,
  is_favorite boolean,
  total_items bigint,
  page integer,
  page_size integer,
  total_pages integer
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_is_owner boolean := false;
  v_total_items bigint;
  v_total_pages integer;
  v_page integer;
begin
  if p_user_id is not null then
    if not exists (
      select 1 from public.accounts account where account.id = p_user_id
    ) then
      raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
    end if;

    v_is_owner := exists (
      select 1 from public.account_profiles membership
      where membership.account_id = p_user_id
        and membership.profile_id = p_profile_id
    );
  end if;

  select count(*)::bigint
  into v_total_items
  from public.profile_messages message
  where message.to_profile_id = p_profile_id
    and (
      v_is_owner
      or (
        p_user_id is not null
        and exists (
          select 1 from public.account_profiles membership
          where membership.account_id = p_user_id
            and membership.profile_id = message.from_profile_id
        )
      )
    );

  v_total_pages := greatest(1, pg_catalog.ceil(v_total_items::numeric / 20)::integer);
  v_page := least(greatest(coalesce(p_page, 1), 1), v_total_pages);

  return query
  select
    message.id,
    message.from_profile_id,
    message.to_profile_id,
    message.content,
    message.created_at_ms,
    message.is_favorite,
    v_total_items,
    v_page,
    20,
    v_total_pages
  from public.profile_messages message
  where message.to_profile_id = p_profile_id
    and (
      v_is_owner
      or (
        p_user_id is not null
        and exists (
          select 1 from public.account_profiles membership
          where membership.account_id = p_user_id
            and membership.profile_id = message.from_profile_id
        )
      )
    )
  order by message.created_at_ms desc
  offset ((v_page - 1) * 20)
  limit 20;
end;
$function$;

revoke all on function public.nexus_get_profile_messages(uuid, uuid, integer) from public, authenticated;
grant execute on function public.nexus_get_profile_messages(uuid, uuid, integer) to anon;

notify pgrst, 'reload schema';
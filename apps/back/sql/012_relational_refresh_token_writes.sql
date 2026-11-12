create or replace function public.nexus_issue_refresh_token(
  p_id uuid,
  p_user_id uuid,
  p_token_hash text,
  p_expires_at_ms bigint,
  p_now_ms bigint,
  p_previous_id uuid default null,
  p_previous_user_id uuid default null,
  p_previous_token_hash text default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_locked_token_count integer;
begin
  if p_id is null
     or p_user_id is null
     or p_token_hash is null
     or p_token_hash = ''
     or p_expires_at_ms is null
     or p_now_ms is null then
    raise exception 'INVALID_REFRESH_TOKEN' using errcode = '22023';
  end if;

  if (
    p_previous_id is null
    and (p_previous_user_id is not null or p_previous_token_hash is not null)
  ) or (
    p_previous_id is not null
    and (p_previous_user_id is null or p_previous_token_hash is null)
  ) then
    raise exception 'INVALID_REFRESH_ROTATION' using errcode = '22023';
  end if;

  if p_previous_id is not null then
    perform token.id
    from public.refresh_tokens token
    where token.id = p_previous_id
      and token.user_id = p_previous_user_id
      and token.token_hash = p_previous_token_hash
      and token.expires_at_ms > p_now_ms
    for update;

    get diagnostics v_locked_token_count = row_count;
    if v_locked_token_count <> 1 then
      raise exception 'REFRESH_TOKEN_REVOKED' using errcode = '42501';
    end if;
  end if;

  delete from public.refresh_tokens
  where expires_at_ms <= p_now_ms;

  if p_previous_id is not null then
    delete from public.refresh_tokens
    where id = p_previous_id
      and user_id = p_previous_user_id
      and token_hash = p_previous_token_hash;
  end if;

  insert into public.refresh_tokens (id, user_id, token_hash, expires_at_ms)
  values (p_id, p_user_id, p_token_hash, p_expires_at_ms);
end;
$function$;

create or replace function public.nexus_revoke_refresh_token(p_token_hash text)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if p_token_hash is null or p_token_hash = '' then
    raise exception 'INVALID_REFRESH_TOKEN_HASH' using errcode = '22023';
  end if;

  delete from public.refresh_tokens
  where token_hash = p_token_hash;
end;
$function$;

revoke all on function public.nexus_issue_refresh_token(uuid, uuid, text, bigint, bigint, uuid, uuid, text) from public, authenticated;
revoke all on function public.nexus_revoke_refresh_token(text) from public, authenticated;
grant execute on function public.nexus_issue_refresh_token(uuid, uuid, text, bigint, bigint, uuid, uuid, text) to anon;
grant execute on function public.nexus_revoke_refresh_token(text) to anon;

notify pgrst, 'reload schema';
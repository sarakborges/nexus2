begin;

-- Auth rate-limit buckets are private server state. The only public RPC that
-- touches this table verifies the backend's existing shared-secret header.
create table private.nexus_auth_rate_limits (
  key_hash text primary key
    check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at_ms bigint not null,
  request_count integer not null check (request_count > 0),
  updated_at_ms bigint not null
);

create index nexus_auth_rate_limits_updated_at_idx
  on private.nexus_auth_rate_limits (updated_at_ms);

alter table private.nexus_auth_rate_limits enable row level security;
revoke all on table private.nexus_auth_rate_limits from public, anon, authenticated;

create or replace function public.nexus_consume_auth_rate_limit(
  p_key_hash text,
  p_window_ms bigint,
  p_max_requests integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now_ms bigint;
  v_request_count integer;
begin
  if not private.nexus_server_request_authorized() then
    raise exception 'NEXUS_SERVER_ACCESS_REQUIRED' using errcode = '42501';
  end if;

  if p_key_hash is null
     or p_key_hash !~ '^[0-9a-f]{64}$'
     or p_window_ms is null
     or p_window_ms < 1000
     or p_window_ms > 86400000
     or p_max_requests is null
     or p_max_requests < 1
     or p_max_requests > 1000 then
    raise exception 'INVALID_AUTH_RATE_LIMIT' using errcode = '22023';
  end if;

  v_now_ms := floor(extract(epoch from pg_catalog.clock_timestamp()) * 1000)::bigint;

  insert into private.nexus_auth_rate_limits as rate_limit (
    key_hash,
    window_started_at_ms,
    request_count,
    updated_at_ms
  )
  values (p_key_hash, v_now_ms, 1, v_now_ms)
  on conflict (key_hash) do update
  set
    window_started_at_ms = case
      when v_now_ms < rate_limit.window_started_at_ms
        or v_now_ms - rate_limit.window_started_at_ms >= p_window_ms
      then v_now_ms
      else rate_limit.window_started_at_ms
    end,
    request_count = case
      when v_now_ms < rate_limit.window_started_at_ms
        or v_now_ms - rate_limit.window_started_at_ms >= p_window_ms
      then 1
      else rate_limit.request_count + 1
    end,
    updated_at_ms = v_now_ms
  returning request_count into v_request_count;

  -- Opportunistically remove abandoned IP buckets without scanning the table
  -- on every authentication attempt.
  if pg_catalog.random() < 0.01 then
    delete from private.nexus_auth_rate_limits
    where updated_at_ms < v_now_ms - 86400000;
  end if;

  return v_request_count <= p_max_requests;
end;
$function$;

revoke all on function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  to anon;

comment on table private.nexus_auth_rate_limits is
  'Private fixed-window rate-limit counters for Nexus sign-in and sign-up attempts.';

notify pgrst, 'reload schema';

commit;

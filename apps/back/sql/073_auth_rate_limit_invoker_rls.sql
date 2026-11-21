-- Run the public auth limiter with caller privileges and guard table access with server-only RLS.
begin;

alter function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  security invoker;

-- The backend uses the anon PostgREST role with the private API-secret header.
-- RLS allows these table operations only when that server header is valid.
grant usage on schema private to anon;
grant execute on function private.nexus_server_request_authorized() to anon;
grant select, insert, update, delete
  on table private.nexus_auth_rate_limits
  to anon;

drop policy if exists nexus_server_access
  on private.nexus_auth_rate_limits;
create policy nexus_server_access
  on private.nexus_auth_rate_limits
  for all
  to anon
  using (private.nexus_server_request_authorized())
  with check (private.nexus_server_request_authorized());

revoke all on function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  from public, authenticated;
grant execute on function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  to anon;

notify pgrst, 'reload schema';

commit;

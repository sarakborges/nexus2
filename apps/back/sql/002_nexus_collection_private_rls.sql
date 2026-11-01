drop function if exists public.nexus_read_collection(text, text);
drop function if exists public.nexus_write_collection(text, jsonb, text);

create or replace function private.nexus_server_request_authorized()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  request_headers jsonb;
  presented_secret text;
  stored_hash text;
begin
  request_headers := coalesce(
    nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb,
    '{}'::jsonb
  );
  presented_secret := request_headers ->> 'x-nexus-api-secret';

  if presented_secret is null or presented_secret = '' then
    return false;
  end if;

  select secret_hash
    into stored_hash
    from private.nexus_service_credentials
   where id is true;

  return stored_hash is not null
     and pg_catalog.encode(
       extensions.digest(
         pg_catalog.convert_to(presented_secret, 'UTF8'),
         'sha256'
       ),
       'hex'
     ) = stored_hash;
exception
  when others then
    return false;
end;
$function$;

revoke all on function private.nexus_server_request_authorized() from public, anon, authenticated;
grant usage on schema private to anon;
grant execute on function private.nexus_server_request_authorized() to anon;

grant select, insert, update on table public.nexus_collections to anon;

drop policy if exists nexus_server_select on public.nexus_collections;
drop policy if exists nexus_server_insert on public.nexus_collections;
drop policy if exists nexus_server_update on public.nexus_collections;

create policy nexus_server_select
on public.nexus_collections
for select
to anon
using (private.nexus_server_request_authorized());

create policy nexus_server_insert
on public.nexus_collections
for insert
to anon
with check (private.nexus_server_request_authorized());

create policy nexus_server_update
on public.nexus_collections
for update
to anon
using (private.nexus_server_request_authorized())
with check (private.nexus_server_request_authorized());
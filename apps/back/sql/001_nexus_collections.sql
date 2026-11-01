create schema if not exists private;

create table if not exists public.nexus_collections (
  collection text primary key check (collection ~ '^[a-zA-Z0-9_-]+$'),
  records jsonb not null default '[]'::jsonb
    check (jsonb_typeof(records) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.nexus_collections enable row level security;
revoke all on table public.nexus_collections from public, anon, authenticated;

create table if not exists private.nexus_service_credentials (
  id boolean primary key default true check (id is true),
  secret_hash text not null
);

alter table private.nexus_service_credentials enable row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on table private.nexus_service_credentials from public, anon, authenticated;

insert into private.nexus_service_credentials (id, secret_hash)
values (true, '9302839c1b1edbe6dc73acce1f0fa974d00aa8394451033665570b1bfcb98cb5')
on conflict (id) do update
set secret_hash = excluded.secret_hash;

create or replace function public.nexus_read_collection(
  p_collection text,
  p_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  stored_hash text;
  collection_records jsonb;
begin
  if p_collection is null or p_collection !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'INVALID_COLLECTION' using errcode = '22023';
  end if;

  select secret_hash
    into stored_hash
    from private.nexus_service_credentials
   where id is true;

  if stored_hash is null
     or pg_catalog.encode(
          extensions.digest(pg_catalog.convert_to(coalesce(p_secret, ''), 'UTF8'), 'sha256'),
          'hex'
        ) <> stored_hash then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  select records
    into collection_records
    from public.nexus_collections
   where collection = p_collection;

  return coalesce(collection_records, '[]'::jsonb);
end;
$function$;

create or replace function public.nexus_write_collection(
  p_collection text,
  p_records jsonb,
  p_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  stored_hash text;
begin
  if p_collection is null or p_collection !~ '^[a-zA-Z0-9_-]+$' then
    raise exception 'INVALID_COLLECTION' using errcode = '22023';
  end if;

  if p_records is null or pg_catalog.jsonb_typeof(p_records) <> 'array' then
    raise exception 'INVALID_RECORDS' using errcode = '22023';
  end if;

  select secret_hash
    into stored_hash
    from private.nexus_service_credentials
   where id is true;

  if stored_hash is null
     or pg_catalog.encode(
          extensions.digest(pg_catalog.convert_to(coalesce(p_secret, ''), 'UTF8'), 'sha256'),
          'hex'
        ) <> stored_hash then
    raise exception 'UNAUTHORIZED' using errcode = '42501';
  end if;

  insert into public.nexus_collections (collection, records, updated_at)
  values (p_collection, p_records, pg_catalog.now())
  on conflict (collection) do update
    set records = excluded.records,
        updated_at = excluded.updated_at;

  return true;
end;
$function$;

revoke all on function public.nexus_read_collection(text, text) from public;
revoke all on function public.nexus_write_collection(text, jsonb, text) from public;
grant execute on function public.nexus_read_collection(text, text) to anon;
grant execute on function public.nexus_write_collection(text, jsonb, text) to anon;

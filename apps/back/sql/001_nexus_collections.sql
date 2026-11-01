create table if not exists public.nexus_collections (
  collection text primary key check (collection ~ '^[a-zA-Z0-9_-]+$'),
  records jsonb not null default '[]'::jsonb
    check (jsonb_typeof(records) = 'array'),
  updated_at timestamptz not null default now()
);

alter table public.nexus_collections enable row level security;

revoke all on table public.nexus_collections from public, anon, authenticated;
grant select, insert, update, delete on table public.nexus_collections to service_role;

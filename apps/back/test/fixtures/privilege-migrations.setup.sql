-- Disposable PostgreSQL 17 fixture for migrations 073-077.
-- Mirrors the relevant Supabase role and default-ACL shape; contains no app data.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

grant usage on schema public to anon, authenticated, service_role;
create schema private;

-- Supabase-style schema defaults: application grants are inherited by objects
-- created by postgres. PostgreSQL's built-in global PUBLIC EXECUTE is left in
-- place here so migration 075 must correctly remove it.
alter default privileges for role postgres in schema public
  grant all privileges on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all privileges on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant execute on functions to anon, authenticated, service_role;

-- Existing app table: client row operations remain available to anon after
-- the hardening sequence, but elevated table privileges must disappear.
create table public.profiles (id integer primary key);
alter table public.profiles enable row level security;
grant truncate, references, trigger, maintain on table public.profiles to public;

-- The internal automation table is not client-facing. Its sequence starts with
-- broad defaults to reproduce the existing grants that migration 077 removes.
create table public.automation_reports (id bigint primary key);
alter table public.automation_reports enable row level security;
revoke all privileges on table public.automation_reports from anon, authenticated;
grant all privileges on table public.automation_reports to service_role;
create sequence public.automation_reports_id_seq;
grant all privileges on sequence public.automation_reports_id_seq to public;

-- The private rate-limit table is inaccessible until migration 073 explicitly
-- grants the backend anon role and adds the server-secret RLS policy.
create table private.nexus_auth_rate_limits (
  key_hash text primary key,
  window_started_at_ms bigint not null,
  request_count integer not null,
  updated_at_ms bigint not null
);
alter table private.nexus_auth_rate_limits enable row level security;

create function private.nexus_server_request_authorized()
returns boolean
language sql
security definer
set search_path = ''
as $function$
  select coalesce(
    (nullif(pg_catalog.current_setting('request.headers', true), '')::jsonb
      ->> 'x-nexus-api-secret') = 'integration-secret',
    false
  );
$function$;
revoke execute on function private.nexus_server_request_authorized() from public;

create function public.nexus_consume_auth_rate_limit(
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
  v_request_count integer;
begin
  insert into private.nexus_auth_rate_limits (
    key_hash, window_started_at_ms, request_count, updated_at_ms
  )
  values (p_key_hash, p_window_ms, 1, p_window_ms)
  on conflict (key_hash) do update
    set request_count = private.nexus_auth_rate_limits.request_count + 1,
        updated_at_ms = private.nexus_auth_rate_limits.updated_at_ms + 1
  returning request_count into v_request_count;

  return v_request_count <= p_max_requests;
end;
$function$;
revoke execute on function public.nexus_consume_auth_rate_limit(text, bigint, integer) from public;
grant execute on function public.nexus_consume_auth_rate_limit(text, bigint, integer)
  to anon, authenticated, service_role;

do $worker_tables$
declare
  table_name text;
begin
  foreach table_name in array array[
    'jobs_active',
    'jobs_contact_outbox',
    'jobs_dedupe',
    'jobs_discovery_state',
    'jobs_interaction_keys',
    'jobs_interactions',
    'jobs_legacy_active_snapshot',
    'jobs_pending',
    'jobs_runs',
    'jobs_state',
    'prospect_contacts',
    'prospect_interactions',
    'prospect_pending',
    'prospect_runs',
    'prospects',
    'prospects_state'
  ]
  loop
    execute format('create table public.%I (id integer primary key)', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('grant all privileges on table public.%I to public', table_name);
  end loop;
end;
$worker_tables$;

create function public.jobs_pending_enforce_status()
returns trigger language plpgsql as $function$
begin
  return new;
end;
$function$;

create function public.jobs_pending_expected_status(text, text, jsonb)
returns text language sql immutable as $function$
  select coalesce($1, $2, $3::text)
$function$;

create function public.normalize_jobs_source(text)
returns text language sql immutable as $function$
  select $1
$function$;

create function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
)
returns boolean language sql as $function$
  select true
$function$;

create function public.set_jobs_active_id()
returns trigger language plpgsql as $function$
begin
  return new;
end;
$function$;

grant execute on function public.jobs_pending_enforce_status()
  to public, anon, authenticated, service_role;
grant execute on function public.jobs_pending_expected_status(text, text, jsonb)
  to public, anon, authenticated, service_role;
grant execute on function public.normalize_jobs_source(text)
  to public, anon, authenticated, service_role;
grant execute on function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
) to public, anon, authenticated, service_role;
grant execute on function public.set_jobs_active_id()
  to public, anon, authenticated, service_role;

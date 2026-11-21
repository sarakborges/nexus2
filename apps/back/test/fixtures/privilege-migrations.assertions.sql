-- Execute the invoker RPC as anon. Without the server header, RLS
-- must reject the table write; with the correct header, the same call succeeds.
set role anon;
select set_config('request.headers', '{}', false);
do $deny_without_secret$
begin
  begin
    perform public.nexus_consume_auth_rate_limit('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 60000, 5);
    raise exception 'rate-limit RPC unexpectedly wrote without the server secret';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$deny_without_secret$;
select set_config('request.headers', '{"x-nexus-api-secret":"integration-secret"}', false);
select public.nexus_consume_auth_rate_limit('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 60000, 5);
reset role;

-- Create future objects after migration 075. No client or PUBLIC privileges
-- should be inherited; service_role defaults must remain intact.
create table public.future_default_table (id integer primary key);
create sequence public.future_default_sequence;
create function public.future_default_function()
returns integer language sql as $function$ select 1 $function$;
create schema private_future_test;
create function private_future_test.future_private_function()
returns integer language sql as $function$ select 1 $function$;

do $assert_privileges$
declare
  worker_table text;
  worker_tables text[] := array[
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
  ];
  worker_function text;
  worker_functions text[] := array[
    'public.jobs_pending_enforce_status()',
    'public.jobs_pending_expected_status(text,text,jsonb)',
    'public.normalize_jobs_source(text)',
    'public.record_jobs_discovery_result(text,text,text,integer,integer,integer,integer,jsonb,text,jsonb)',
    'public.set_jobs_active_id()'
  ];
  has_public_execute boolean;
  has_public_elevated_table_privilege boolean;
  has_public_table_privilege boolean;
  has_public_sequence_privilege boolean;
begin
  -- Migration 073: RPC is SECURITY INVOKER and has only the intended callers.
  if (select prosecdef
      from pg_proc
      where oid = 'public.nexus_consume_auth_rate_limit(text,bigint,integer)'::regprocedure) then
    raise exception 'auth rate-limit RPC is still SECURITY DEFINER';
  end if;
  if not has_function_privilege('anon', 'public.nexus_consume_auth_rate_limit(text,bigint,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.nexus_consume_auth_rate_limit(text,bigint,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.nexus_consume_auth_rate_limit(text,bigint,integer)', 'EXECUTE') then
    raise exception 'auth rate-limit RPC EXECUTE grants are incorrect';
  end if;
  if not has_schema_privilege('anon', 'private', 'USAGE')
     or not has_function_privilege('anon', 'private.nexus_server_request_authorized()', 'EXECUTE')
     or not has_table_privilege('anon', 'private.nexus_auth_rate_limits', 'SELECT')
     or not has_table_privilege('anon', 'private.nexus_auth_rate_limits', 'INSERT')
     or not has_table_privilege('anon', 'private.nexus_auth_rate_limits', 'UPDATE')
     or not has_table_privilege('anon', 'private.nexus_auth_rate_limits', 'DELETE')
     or has_table_privilege('authenticated', 'private.nexus_auth_rate_limits', 'SELECT') then
    raise exception 'private auth limiter table grants are incorrect';
  end if;
  if not exists (
    select 1
    from pg_policy
    where polrelid = 'private.nexus_auth_rate_limits'::regclass
      and polname = 'nexus_server_access'
      and polroles @> array[(select oid from pg_roles where rolname = 'anon')]::oid[]
      and pg_get_expr(polqual, polrelid) like '%nexus_server_request_authorized%'
      and pg_get_expr(polwithcheck, polrelid) like '%nexus_server_request_authorized%'
  ) then
    raise exception 'auth limiter server-secret RLS policy is missing or incomplete';
  end if;

  -- Migration 074: all client/PUBLIC table rights disappear on worker tables;
  -- service_role keeps the operations used by the background workers.
  foreach worker_table in array worker_tables
  loop
    if has_table_privilege('anon', format('public.%I', worker_table), 'SELECT')
       or has_table_privilege('anon', format('public.%I', worker_table), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', worker_table), 'SELECT')
       or has_table_privilege('authenticated', format('public.%I', worker_table), 'INSERT')
      select exists (
      select 1 from pg_class c
      cross join lateral aclexplode(c.relacl) acl
      where c.oid = to_regclass(format('public.%I', worker_table))
        and acl.grantee = 0
    ) into has_public_table_privilege;
    if has_public_table_privilege then
      raise exception 'PUBLIC access remains on worker table %', worker_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', worker_table), 'SELECT')
       or not has_table_privilege('service_role', format('public.%I', worker_table), 'INSERT')
       or not has_table_privilege('service_role', format('public.%I', worker_table), 'UPDATE')
       or not has_table_privilege('service_role', format('public.%I', worker_table), 'DELETE') then
      raise exception 'service_role lost required worker table privileges on %', worker_table;
    end if;
  end loop;

  foreach worker_function in array worker_functions
  loop
    select exists (
      select 1 from pg_proc p
      cross join lateral aclexplode(p.proacl) acl
      where p.oid = worker_function::regprocedure
        and acl.grantee = 0
        and acl.privilege_type = 'EXECUTE'
    ) into has_public_execute;
    if has_function_privilege('anon', worker_function, 'EXECUTE')
       or has_function_privilege('authenticated', worker_function, 'EXECUTE')
       or has_public_execute
       or not has_function_privilege('service_role', worker_function, 'EXECUTE') then
      raise exception 'worker function EXECUTE grants are incorrect: %', worker_function;
    end if;
  end loop;

  -- Migration 076: anon retains row operations on app tables but not elevated
  -- table privileges. service_role privileges remain unchanged.
  if not has_table_privilege('anon', 'public.profiles', 'SELECT')
     or not has_table_privilege('anon', 'public.profiles', 'INSERT')
     or not has_table_privilege('anon', 'public.profiles', 'UPDATE')
     or not has_table_privilege('anon', 'public.profiles', 'DELETE') then
    raise exception 'anon lost ordinary row operations on profiles';
  end if;
  if has_table_privilege('anon', 'public.profiles', 'TRUNCATE')
     or has_table_privilege('anon', 'public.profiles', 'REFERENCES')
     or has_table_privilege('anon', 'public.profiles', 'TRIGGER')
     or has_table_privilege('anon', 'public.profiles', 'MAINTAIN') then
    raise exception 'anon retained elevated table privileges on profiles';
  end if;
  select exists (
    select 1
    from pg_class c
    cross join lateral aclexplode(c.relacl) acl
    where c.oid = 'public.profiles'::regclass
      and acl.grantee = 0
      and acl.privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN')
  ) into has_public_elevated_table_privilege;
  if has_public_elevated_table_privilege then
    raise exception 'PUBLIC retained elevated table privileges on profiles';
  end if;
  if not has_table_privilege('service_role', 'public.profiles', 'SELECT')
     or not has_table_privilege('service_role', 'public.profiles', 'INSERT')
     or not has_table_privilege('service_role', 'public.profiles', 'UPDATE')
     or not has_table_privilege('service_role', 'public.profiles', 'DELETE')
     or not has_table_privilege('service_role', 'public.profiles', 'TRUNCATE')
     or not has_table_privilege('service_role', 'public.profiles', 'MAINTAIN') then
    raise exception 'service_role table privileges changed unexpectedly';
  end if;

  -- Migration 077: no existing public table/function/sequence access remains
  -- for the unused authenticated role. The BFF's anon role remains separate.
  if has_table_privilege('authenticated', 'public.profiles', 'SELECT')
     or has_table_privilege('authenticated', 'public.profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.profiles', 'DELETE')
     or has_function_privilege('authenticated', 'public.nexus_consume_auth_rate_limit(text,bigint,integer)', 'EXECUTE')
     or has_sequence_privilege('authenticated', 'public.automation_reports_id_seq', 'USAGE') then
    raise exception 'authenticated retains a public-schema privilege';
  end if;
  select exists (
    select 1 from pg_class c
    cross join lateral aclexplode(c.relacl) acl
    where c.oid = 'public.automation_reports_id_seq'::regclass
      and acl.grantee = 0
  ) into has_public_sequence_privilege;
  if has_sequence_privilege('anon', 'public.automation_reports_id_seq', 'USAGE')
     or has_sequence_privilege('anon', 'public.automation_reports_id_seq', 'SELECT')
     or has_sequence_privilege('anon', 'public.automation_reports_id_seq', 'UPDATE')
     or has_public_sequence_privilege
     or not has_sequence_privilege('service_role', 'public.automation_reports_id_seq', 'USAGE') then
    raise exception 'worker automation sequence grants are incorrect';
  end if;

  -- Migration 075: future objects created by postgres inherit only the
  -- service_role grant in public. The global PUBLIC function default is gone.
  if has_table_privilege('anon', 'public.future_default_table', 'SELECT')
     or has_table_privilege('authenticated', 'public.future_default_table', 'SELECT')
     or not has_table_privilege('service_role', 'public.future_default_table', 'SELECT') then
    raise exception 'future public table default privileges are incorrect';
  end if;
  select exists (
    select 1 from pg_class c
    cross join lateral aclexplode(c.relacl) acl
    where c.oid = 'public.future_default_sequence'::regclass
      and acl.grantee = 0
  ) into has_public_sequence_privilege;
  if has_sequence_privilege('anon', 'public.future_default_sequence', 'USAGE')
     or has_sequence_privilege('authenticated', 'public.future_default_sequence', 'USAGE')
     or has_public_sequence_privilege
     or not has_sequence_privilege('service_role', 'public.future_default_sequence', 'USAGE') then
    raise exception 'future public sequence default privileges are incorrect';
  end if;
  if has_function_privilege('anon', 'public.future_default_function()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.future_default_function()', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.future_default_function()', 'EXECUTE') then
    raise exception 'future public function default privileges are incorrect';
  end if;
  select exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(p.proacl) acl
    where p.oid in (
      'public.future_default_function()'::regprocedure,
      'private_future_test.future_private_function()'::regprocedure
    )
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) into has_public_execute;
  if has_public_execute then
    raise exception 'global PUBLIC EXECUTE default remains for postgres-created functions';
  end if;
end;
$assert_privileges$;

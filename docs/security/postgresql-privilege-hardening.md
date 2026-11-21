# PostgreSQL privilege hardening review

**Snapshot:** 2026-11-21  
**Status:** read-only production audit. No database grants, defaults, schema, or data were changed.

## Findings

### Tables and RLS

- The exposed public schema contains 38 ordinary/partitioned tables. All 38 are owned by postgres and have RLS enabled.
- 33 tables grant both anon and authenticated the full DML set plus TRUNCATE, REFERENCES, TRIGGER, and PostgreSQL 17's MAINTAIN privilege.
- The Nexus BFF accesses Postgres through the anon role and a server-only x-nexus-api-secret header. Do not remove the existing anon DML grants on application tables without changing that access design; the RLS policies use the server-secret check.
- The app uses Nexus-issued JWTs rather than Supabase Auth user JWTs. The BFF does not currently use the authenticated database role.
- Twenty public tables have RLS enabled but no policies (default-deny). Sixteen of those nevertheless grant DML to both anon and authenticated:
  - jobs_active
  - jobs_contact_outbox
  - jobs_dedupe
  - jobs_discovery_state
  - jobs_interaction_keys
  - jobs_interactions
  - jobs_legacy_active_snapshot
  - jobs_pending
  - jobs_runs
  - jobs_state
  - prospect_contacts
  - prospect_interactions
  - prospect_pending
  - prospect_runs
  - prospects
  - prospects_state

The service_role retains the DML needed by the automation workers. Four other no-policy tables already deny anon/authenticated at the table-grant layer.

### Functions

- There are 81 functions in public; six are SECURITY DEFINER.
- Five of the six definer functions are callable only by service_role among the Data API roles.
- The remaining definer function, public.nexus_consume_auth_rate_limit(text, bigint, integer), is callable as anon because the BFF uses the existing server-only header. Its body calls private.nexus_server_request_authorized(), validates its parameters, and sets an empty search_path.
- Five job helper functions have an explicit EXECUTE grant to PUBLIC as well as direct grants to anon, authenticated, and service_role:
  - jobs_pending_enforce_status()
  - jobs_pending_expected_status(text, text, jsonb)
  - normalize_jobs_source(text)
  - record_jobs_discovery_result(text, text, text, integer, integer, integer, integer, jsonb, text, jsonb)
  - set_jobs_active_id()

The current ACLs show direct grants to service_role for all five. A hardening migration can revoke EXECUTE from PUBLIC, anon, and authenticated, while retaining/granting EXECUTE to service_role.

### Default privileges and ownership

The production default ACLs for both postgres and supabase_admin in public currently add broad access to new objects:

- Tables: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN for anon, authenticated, and service_role.
- Functions: EXECUTE for anon, authenticated, and service_role, in addition to PostgreSQL's built-in default PUBLIC EXECUTE.
- Sequences: USAGE, SELECT, UPDATE for anon, authenticated, and service_role.

The current database connection acts as postgres, which is not a member of supabase_admin. It can adjust postgres defaults and existing application objects (all 38 public tables are owned by postgres), but cannot adjust supabase_admin default ACLs. Future objects created by supabase_admin would therefore retain that owner's defaults until an appropriately privileged administrator changes them.

## Proposed hardening SQL

This is a reviewed proposal, **not an applied migration**. Generate the eventual migration with the Supabase CLI and verify it on a development database before applying it to production.

~~~sql
begin;

-- Keep the existing anon DML path for app-facing Nexus tables.
-- Remove capabilities the browser/API role does not need.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

-- Internal job/prospect tables have RLS enabled but intentionally no policies.
-- They are accessed by the service role, not by the Nexus BFF.
revoke all privileges on table
  public.jobs_active,
  public.jobs_contact_outbox,
  public.jobs_dedupe,
  public.jobs_discovery_state,
  public.jobs_interaction_keys,
  public.jobs_interactions,
  public.jobs_legacy_active_snapshot,
  public.jobs_pending,
  public.jobs_runs,
  public.jobs_state,
  public.prospect_contacts,
  public.prospect_interactions,
  public.prospect_pending,
  public.prospect_runs,
  public.prospects,
  public.prospects_state
  from anon, authenticated;

-- The five legacy job helpers need to remain callable by server workers only.
revoke execute on function public.jobs_pending_enforce_status()
  from public, anon, authenticated;
grant execute on function public.jobs_pending_enforce_status()
  to service_role;

revoke execute on function public.jobs_pending_expected_status(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.jobs_pending_expected_status(text, text, jsonb)
  to service_role;

revoke execute on function public.normalize_jobs_source(text)
  from public, anon, authenticated;
grant execute on function public.normalize_jobs_source(text)
  to service_role;

revoke execute on function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
) to service_role;

revoke execute on function public.set_jobs_active_id()
  from public, anon, authenticated;
grant execute on function public.set_jobs_active_id()
  to service_role;

-- Public sequences are not used by the Nexus app (UUID identifiers).
revoke all privileges on all sequences in schema public
  from anon, authenticated;

-- New public objects must be opt-in.
alter default privileges for role postgres in schema public
  revoke all privileges on tables
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences
  from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions
  from anon, authenticated, service_role;

-- This must be global: per-schema REVOKE cannot remove built-in PUBLIC EXECUTE.
alter default privileges for role postgres
  revoke execute on functions from public;

commit;
~~~

The migration history uses explicit grants for first-time public RPC definitions. The contract test added with this review checks that every first public function declaration in the migration files includes an explicit EXECUTE grant or revoke. Replacements of existing functions retain their current ACLs and do not need to restate them.

## Verification required after approval

1. Confirm existing application CRUD still works through anon plus x-nexus-api-secret.
2. Confirm the 16 internal job/prospect tables deny anon and authenticated at the privilege layer while service_role can still read/write.
3. Confirm anon/authenticated have no TRUNCATE, REFERENCES, TRIGGER, or MAINTAIN privileges on public tables.
4. Confirm no anon/authenticated privileges remain on public sequences.
5. Confirm the five job helpers remain executable by service_role but not anon/authenticated/PUBLIC.
6. Confirm newly created tables, functions, and sequences receive no unintended default grants.
7. Run Supabase security advisors and the full workspace CI.

## References

- Supabase: Securing your API — https://supabase.com/docs/guides/api/securing-your-api
- PostgreSQL 17: ALTER DEFAULT PRIVILEGES — https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
- PostgreSQL current: ALTER DEFAULT PRIVILEGES — https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html

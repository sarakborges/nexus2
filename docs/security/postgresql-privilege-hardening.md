# PostgreSQL privilege hardening review

**Snapshot:** 2026-11-21  
**Status:** read-only production audit. No database grants, defaults, schema, or data were changed.

## Findings

### Tables and RLS

- The exposed public schema contains 38 ordinary/partitioned tables. All 38 are owned by postgres and have RLS enabled.
- 33 tables grant both anon and authenticated the full DML set plus TRUNCATE, REFERENCES, TRIGGER, and PostgreSQL 17's MAINTAIN privilege.
- The Nexus BFF accesses Postgres through the anon role and a server-only x-nexus-api-secret header. The repository's Supabase client sends a publishable key and the server-only secret; it does not send a Supabase Auth user JWT.
- The app uses Nexus-issued JWTs rather than Supabase Auth user JWTs. The BFF does not use the authenticated database role.
- Production has 33 public RLS policies. All 33 target anon; none target authenticated or PUBLIC.
- authenticated nevertheless has SELECT, INSERT, UPDATE and DELETE privileges on 33 public tables. There is no current application policy or BFF path requiring those grants. This role can be stripped of all privileges on public tables, sequences, and functions without changing the current Nexus access model.
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

These 16 tables are not referenced by the Nexus2 application source tree. Production pg_stat_statements has no tracked top-level statement text referencing these tables since statistics were reset on 2026-11-01. Table activity counters are also zero. This does not exclude nested SQL, external workers, or other untracked access. The proposed hardening therefore preserves service_role privileges and treats removal of anon DML on these tables as a separate decision pending confirmation of any off-repository workers.

### Functions

- There are 81 functions in public; six are SECURITY DEFINER.
- Five of the six definer functions are callable only by service_role among the Data API roles.
- The remaining definer function, public.nexus_consume_auth_rate_limit(text, bigint, integer), is callable as anon because the BFF uses the existing server-only header. Its body calls private.nexus_server_request_authorized(), validates its parameters, and sets an empty search_path.
- Five job helper functions currently inherit EXECUTE from PUBLIC and are also directly granted to anon, authenticated, and service_role:
  - jobs_pending_enforce_status()
  - jobs_pending_expected_status(text, text, jsonb)
  - normalize_jobs_source(text)
  - record_jobs_discovery_result(text, text, text, integer, integer, integer, integer, jsonb, text, jsonb)
  - set_jobs_active_id()

All five have direct service_role grants. A hardening migration can revoke PUBLIC and authenticated execution globally while retaining the direct anon and service_role grants. Revoking anon from these helpers is deferred until any off-repository worker dependency is confirmed.

### Default privileges and ownership

The production default ACLs for both postgres and supabase_admin in public currently add broad access to new objects:

- Tables: SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN for anon, authenticated, and service_role.
- Functions: EXECUTE for anon, authenticated, and service_role, in addition to PostgreSQL's built-in default PUBLIC EXECUTE.
- Sequences: USAGE, SELECT, UPDATE for anon, authenticated, and service_role.

The current database connection acts as postgres, which is not a member of supabase_admin. It can adjust postgres defaults and existing application objects (all 38 public tables are owned by postgres), but cannot adjust supabase_admin default ACLs. Future objects created by supabase_admin would therefore retain that owner's defaults until an appropriately privileged administrator changes them.

### Development environment

No Supabase development branches currently exist for this project. Creating one requires a separate cost check and organization selection. No branch was created and no project billing or production configuration was changed.

## Proposed hardening SQL

This is a reviewed proposal, **not an applied migration**. Generate the eventual migration with the Supabase CLI and verify it on a development database before applying it to production.

~~~sql
begin;

-- Nexus does not use Supabase Auth's authenticated role.
-- All current public RLS policies target anon, and the BFF uses anon plus
-- its server-only secret. Preserve the direct anon and service_role grants.
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

-- Remove the built-in PUBLIC EXECUTE path and all authenticated function access.
-- Explicit grants to anon and service_role remain intact.
revoke execute on all functions in schema public from public, authenticated;

-- anon only needs ordinary DML; it does not need database administration powers.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon;

-- Internal job/prospect tables currently have no RLS policies. Do not remove
-- their anon DML grants until any external worker using anon is ruled out.
-- service_role retains its current table grants.

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

Important consequences:

- The current direct grants to anon and service_role on existing functions are preserved by the function revocation above; only PUBLIC and authenticated inheritance are removed.
- Existing service_role table access is retained. New tables, functions, and sequences created by postgres will need explicit grants in their migrations.
- The new migration contract test requires explicit EXECUTE grants/revokes for first-time public RPC definitions, explicit grants for any new public table after the current baseline (068), and public RLS policies scoped to anon only.
- Defaults owned by supabase_admin remain unresolved until an appropriately privileged administrator changes them.

## Verification required before production rollout

1. Confirm existing application CRUD still works through anon plus x-nexus-api-secret.
2. Confirm authenticated has no effective privileges on public tables, sequences, or functions.
3. Confirm anon has no TRUNCATE, REFERENCES, TRIGGER, or MAINTAIN privileges on public tables.
4. Confirm anon and service_role retain the function grants required by the application.
5. Check for off-repository workers before revoking anon DML from the 16 job/prospect tables or anon EXECUTE from their helper functions.
6. Confirm new public objects receive no unintended default grants under postgres and separately remediate supabase_admin defaults.
7. Run Supabase security advisors and full workspace CI.

## References

- Supabase: Securing your API — https://supabase.com/docs/guides/api/securing-your-api
- PostgreSQL 17: ALTER DEFAULT PRIVILEGES — https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html
- PostgreSQL current: ALTER DEFAULT PRIVILEGES — https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html

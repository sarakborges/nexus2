-- Make grants on future public-schema objects opt-in for the role that owns
-- the application's existing public tables. Preserve service_role defaults.
begin;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- PostgreSQL's built-in PUBLIC EXECUTE default is global for the object
-- creator. A schema-scoped REVOKE cannot subtract a global default grant.
-- Remove it for future postgres-owned functions; callers must be granted
-- EXECUTE explicitly. Existing functions and other owner roles are unchanged.
alter default privileges for role postgres
  revoke execute on functions from public;

commit;

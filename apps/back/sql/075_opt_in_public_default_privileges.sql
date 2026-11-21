-- Make grants on future public-schema objects opt-in for the role that owns
-- the application's existing public tables. Preserve service_role defaults.
begin;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

commit;

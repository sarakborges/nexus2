-- Nexus sessions are authenticated by the BFF with application JWTs.
-- The BFF uses the Supabase anon role plus its server-only request header;
-- no current application path uses the Supabase authenticated database role.
-- Keep that role out of the exposed public schema unless a future feature
-- explicitly introduces Supabase Auth and adds reviewed grants/policies.
begin;

revoke all privileges on all tables in schema public
  from authenticated;

revoke all privileges on all sequences in schema public
  from authenticated;

revoke execute on all functions in schema public
  from authenticated;

-- The only public sequence belongs to worker-only automation_reports.
-- The table itself has no anon/authenticated privileges.
revoke all privileges on all sequences in schema public
  from public, anon;

notify pgrst, 'reload schema';

commit;

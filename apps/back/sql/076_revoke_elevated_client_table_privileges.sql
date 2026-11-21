-- Client roles need ordinary row operations only. Privileges such as
-- TRUNCATE bypass RLS, while REFERENCES, TRIGGER and MAINTAIN are DDL/maintenance
-- capabilities that the BFF does not require.
begin;

revoke truncate, references, trigger, maintain
  on all tables in schema public
  from public, anon, authenticated;

commit;

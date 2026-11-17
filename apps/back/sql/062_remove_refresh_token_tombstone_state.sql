begin;

-- The account soft-delete cascade must revoke refresh credentials physically.
do $migration$
declare
  v_definition text;
  v_old text := $old$
    update public.refresh_tokens as token
    set deleted_at_ms = v_deleted_at_ms
    where token.user_id = new.id
      and token.deleted_at_ms is null;
$old$;
  v_new text := $new$
    delete from public.refresh_tokens as token
    where token.user_id = new.id;
$new$;
begin
  v_definition := pg_get_functiondef('private.nexus_propagate_soft_delete()'::regprocedure);

  if position(v_old in v_definition) = 0 then
    raise exception 'EXPECTED_REFRESH_TOKEN_SOFT_DELETE_CASCADE_NOT_FOUND';
  end if;

  v_definition := replace(v_definition, v_old, v_new);
  execute v_definition;
end;
$migration$;

-- Refresh tokens have no tombstone state. The server-only access policy is
-- sufficient; revocation and expiry remove rows physically.
drop policy if exists nexus_active_rows_only on public.refresh_tokens;
alter table public.refresh_tokens
  drop column if exists deleted_at_ms;

notify pgrst, 'reload schema';

commit;

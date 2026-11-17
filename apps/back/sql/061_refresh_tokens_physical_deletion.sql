begin;

-- Refresh tokens are revocable credentials, not domain records. Expiration,
-- rotation and sign-out must physically remove rows rather than tombstone them.
drop trigger if exists nexus_soft_delete_before_delete on public.refresh_tokens;
drop trigger if exists nexus_soft_delete_cascade on public.refresh_tokens;

-- Preserve read filtering for any historical tombstones, but do not apply the
-- tombstone check to INSERT, UPDATE or DELETE operations.
drop policy if exists nexus_active_rows_only on public.refresh_tokens;
create policy nexus_active_rows_only
  on public.refresh_tokens
  as restrictive
  for select
  to anon
  using (deleted_at_ms is null);

-- Account removal is a logical delete for the account and its domain data,
-- but refresh credentials are physically revoked before the account tombstone.
create or replace function public.nexus_delete_account(
  p_user_id uuid,
  p_now_ms bigint
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_deleted_count integer;
begin
  if p_user_id is null or p_now_ms is null then
    raise exception 'INVALID_ACCOUNT_DELETE' using errcode = '22023';
  end if;

  perform private.nexus_lock_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);

  delete from public.refresh_tokens as token
  where token.user_id = p_user_id;

  update public.accounts as account
  set current_profile_id = null,
      deleted_at_ms = p_now_ms
  where account.id = p_user_id
    and account.deleted_at_ms is null;

  get diagnostics v_deleted_count = row_count;
  if v_deleted_count <> 1 then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform private.nexus_bump_collection_versions(array[
    'accounts','profiles','communities','relationships','community_relationships',
    'profile_posts','profile_settings','profile_messages','community_forum_topics',
    'community_forum_replies','media_files'
  ]::text[]);
end;
$function$;

notify pgrst, 'reload schema';

commit;

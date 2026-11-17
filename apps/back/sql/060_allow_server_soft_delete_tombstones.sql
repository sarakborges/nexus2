-- Keep tombstones hidden from reads without blocking server-side soft deletes.
--
-- A SELECT-only restrictive active-row policy can reject the NEW row produced
-- when the BEFORE DELETE trigger converts a physical DELETE into an UPDATE
-- that sets deleted_at_ms. Make the policy apply to every command: old rows
-- must be active, while any inserted/updated row must come from an authorized
-- backend request. The existing permissive nexus_server_access policy remains
-- in place as the table's server-only access gate.
begin;

do $migration$
declare
  v_table text;
  v_tables text[] := array[
    'accounts',
    'account_profiles',
    'account_preferences',
    'profiles',
    'communities',
    'relationships',
    'community_relationships',
    'profile_posts',
    'profile_settings',
    'profile_activity_preferences',
    'profile_messages',
    'community_forum_topics',
    'community_forum_replies',
    'refresh_tokens',
    'media_files',
    'activity_notification_reads',
    'feed_activities'
  ];
begin
  foreach v_table in array v_tables loop
    -- media_files intentionally has no active-row read policy: the cleanup
    -- worker must continue to find rows while their Storage objects are being
    -- removed. Its separate server_access policy still protects the table.
    if v_table <> 'media_files' then
      execute format(
        'drop policy if exists nexus_active_rows_only on public.%I',
        v_table
      );

      execute format(
        'create policy nexus_active_rows_only
           on public.%I
           as restrictive
           for all
           to anon
           using (deleted_at_ms is null)
           with check (private.nexus_server_request_authorized())',
        v_table
      );
    end if;
  end loop;
end;
$migration$;

commit;

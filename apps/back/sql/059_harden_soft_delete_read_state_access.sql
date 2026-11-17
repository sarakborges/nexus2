-- Keep notification read-state writes under RLS instead of SECURITY DEFINER.
begin;

alter function public.nexus_get_activity_read_ids(uuid, text[])
  security invoker;

alter function public.nexus_mark_activities_read(uuid, text[], bigint)
  security invoker;

-- The policy remains server-header-only; the backend needs INSERT for the
-- idempotent ON CONFLICT write path used by the notification RPC.
grant insert on public.activity_notification_reads to anon;

-- Support feed-row tombstoning and FK maintenance without scanning the whole
-- notification read-state table for each activity.
create index if not exists activity_notification_reads_activity_id_idx
  on public.activity_notification_reads (activity_id);

notify pgrst, 'reload schema';

commit;

-- Internal automation and prospect state is worker-owned, not client-facing.
-- RLS has no policies for these tables; remove the otherwise unnecessary role grants.
begin;

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
from public, anon, authenticated;

-- These functions are worker helpers or trigger helpers. Their previous
-- default PUBLIC EXECUTE grants exposed unnecessary RPC surfaces. Preserve
-- execution for the service_role used by the automation workers.
revoke all on function public.jobs_pending_enforce_status()
  from public, anon, authenticated;
grant execute on function public.jobs_pending_enforce_status()
  to service_role;

revoke all on function public.jobs_pending_expected_status(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.jobs_pending_expected_status(text, text, jsonb)
  to service_role;

revoke all on function public.normalize_jobs_source(text)
  from public, anon, authenticated;
grant execute on function public.normalize_jobs_source(text)
  to service_role;

revoke all on function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_jobs_discovery_result(
  text, text, text, integer, integer, integer, integer, jsonb, text, jsonb
) to service_role;

revoke all on function public.set_jobs_active_id()
  from public, anon, authenticated;
grant execute on function public.set_jobs_active_id()
  to service_role;

notify pgrst, 'reload schema';

commit;

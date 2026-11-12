-- The generic relational synchronizer was only called by
-- public.nexus_commit_relational(jsonb), retired in migration 043.
-- Targeted relational RPCs write directly to normalized tables and continue
-- to use nexus_collection_versions only as transaction/version metadata.
drop function if exists private.nexus_sync_relational_collection(text, jsonb);

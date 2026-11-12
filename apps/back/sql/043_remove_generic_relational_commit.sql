-- The relational adapter no longer supports generic collection snapshots.
-- All production reads and writes go through targeted SQL/RPC operations.
-- Keep nexus_collection_versions as metadata for version bumps and row locks.

drop function if exists public.nexus_commit_relational(jsonb);

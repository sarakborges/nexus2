-- Retire the transitional JSONB collection store now that Nexus data
-- has been transferred to normalized relational tables and the application
-- uses SupabaseRelationalRepository.
--
-- Keep nexus_collection_versions: relational RPCs still use it to coordinate
-- concurrent multi-table writes. nexus_commit_relational is also retained
-- for the compatibility transaction interface, but it synchronizes rows in
-- relational tables and does not store domain data in JSONB collections.

drop function if exists public.nexus_read_collection_by_ids(text, text[]);
drop function if exists public.nexus_commit_collections(jsonb);
drop table if exists public.nexus_collections;

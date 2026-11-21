-- Keep managed image objects within the application upload limit.
-- This is a forward-only Storage configuration change; existing objects are not rewritten.
begin;

update storage.buckets
set file_size_limit = 1048576
where id in (
  'nexus-avatars',
  'nexus-community-avatars',
  'nexus-editor-images'
);

commit;

# Community avatar storage cutover

Community avatar images must be moved out of the public `nexus-avatars` bucket.
Profile avatars remain public. The application change and migration `069_private_community_avatars.sql`
introduce the private `nexus-community-avatars` bucket and serve community images through
`/api/uploads/community-avatars/{uploadId}/content`.

## Required rollout sequence

1. Take and retain a database backup and a Storage inventory.
2. Confirm every non-empty `communities.picture` that references a managed legacy community avatar
   maps to exactly one `media_files` row with `purpose = 'community-avatar'`, the legacy bucket
   `nexus-avatars`, and the expected object path. Stop on missing, duplicate, or unexpected rows.
3. Apply migration 069 and deploy the backend and BFF changes together. The BFF must proxy the
   new route as binary; public profile avatars remain on the existing public route.
4. Copy each referenced object from `nexus-avatars` to `nexus-community-avatars` using the same
   path. Verify the destination exists and its byte length and MIME type match the source before
   changing any database reference.
5. In one database transaction, update each matching `media_files.bucket` to
   `nexus-community-avatars` and replace `communities.picture` with
   `/api/uploads/community-avatars/{media_files.id}/content`. Recheck that every migrated
   community avatar has exactly one matching row and every profile avatar still references
   `nexus-avatars`.
6. Remove the legacy community-avatar objects from the public bucket only after the destination
   and database references have been verified. Never remove paths referenced by profile avatars.
7. Verify reads for public, unlisted, and private communities using member, non-member, and
   anonymous sessions. Verify that changing a private community's membership immediately changes
   avatar access. Check upload, replacement, deletion, and ordinary metadata edits.

## Important

This migration file creates the private bucket and changes application RPC behavior; it does not
copy or delete Storage objects, nor rewrite existing community picture URLs. Until the object
cutover is completed, old community-avatar URLs in the public bucket remain publicly retrievable.
Do not describe the privacy issue as fully remediated until the inventory, copy, database update,
old-object removal, and access tests above have all passed.

Do not make the cutover against production without an explicit rollout approval and a tested backup
and rollback plan. Do not change the visibility of `nexus-avatars`: profile avatars still use it.

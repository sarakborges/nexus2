# Private community avatar setup and tests

The application is not publicly available and there is no legacy user-upload population to migrate.
No object copy, backfill, URL rewrite, or legacy public-object deletion process is required.

Migration `069_private_community_avatars.sql` is an application schema/configuration migration,
not a data migration. It creates the private `nexus-community-avatars` Storage bucket and updates
the upload and community RPCs to use it. Apply it only to the isolated test/development database
used to validate this change before using the application.

## Test coverage

- Community-avatar uploads are signed into the private `nexus-community-avatars` bucket.
- Profile avatars continue to use the existing public `nexus-avatars` bucket.
- Community-avatar reads pass through the backend and are checked against the current community
  privacy and effective owner-inherited profile type.
- Anonymous and non-member reads of private-community avatars are denied before Storage bytes
  are requested.
- Community creation, avatar replacement, metadata-only edits, avatar removal, and cleanup preserve
  media ownership and attachment invariants.
- The BFF proxies the community-avatar route as binary and preserves `private, no-store` headers.

No production data or Storage objects need to be migrated for this application state. Do not run
migration 069 against production as part of this test task.

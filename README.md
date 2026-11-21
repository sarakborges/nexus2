# Nexus monorepo

## Workspaces

- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies, token refresh and HTTP forwarding.
- `apps/back`: NestJS domain API. Owns authentication, authorization, validation, domain services and persistence.
- `packages/common`: shared domain models, DTO contracts and pagination types.

The three applications are deployed together in one Vercel project using Vercel Services. Only community forum topic pages use live updates: the frontend opens a Supabase Realtime WebSocket for the active topic. Other views still load normally when opened, but do not refresh in the background on a timer, window focus or network reconnect. Explicit mutations continue to refresh the data they change. The BFF is the only public API service; the domain backend remains private and is reached through a Vercel service binding.

## Development

Requires Node.js 22.22+ and npm workspaces.

```bash
npm ci
cp apps/back/.env.example apps/back/.env
cp apps/bff/.env.example apps/bff/.env
npm run dev
```

- Front: http://localhost:5173
- BFF: http://localhost:3001
- Back: http://localhost:3002

The default Vite development server proxies `/api` to the local BFF. The backend requires `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_API_SECRET` in every environment and fails fast when they are missing. Local development uses the same relational Supabase repository as deployment; there is no JSON-file fallback. Configure `SUPABASE_STORAGE_SECRET_KEY` as well when testing uploads or forum-topic publishing.

### Use the production BFF with the local frontend

To run only the frontend while sending API requests to the production BFF:

```bash
npm run dev:front:prod-bff
```

Open http://localhost:5173. The Vite server proxies `/api` to `https://nexus-hope.vercel.app`; browser requests remain same-origin with localhost, so the BFF's HttpOnly session cookies are stored for the local development host instead of requiring a direct cross-origin request. This mode does not start the local BFF or backend and does not require their `.env` files.

**This mode uses production accounts and data.** Sign-ups, profile changes, messages, relationship actions and other writes affect the production environment. Use it only when you intend to work against production data.

The target can be overridden with `BFF_PROXY_TARGET` in the Vite mode's environment.

## Deployment on Vercel

The root `vercel.json` defines three container services in one Vercel project:

| Service | Dockerfile | Public access |
| --- | --- | --- |
| `front` | `Dockerfile.front` | All non-API routes |
| `bff` | `Dockerfile.bff` | `/api/*` |
| `back` | `Dockerfile.back` | Private; BFF service binding only |

All three services use the repository root as their Docker build context so they can access the common npm lockfile and workspace packages. Each Dockerfile builds only its own application. The BFF receives `BACKEND_SERVICE_URL` from its Vercel binding and appends the backend's `/api` prefix. Vercel's top-level rewrites send API requests directly to the BFF; the frontend container only serves the SPA. The browser never receives a backend URL or database credential. No public `VITE_BFF_URL` is needed.

### Vercel project settings

1. Keep the project's Root Directory at the repository root (`.`).
2. Set Framework Preset to **Services** in Build & Development Settings. This is required; a `services` object in `vercel.json` alone does not switch the project to Services mode.
3. Keep project-level Install Command, Build Command and Output Directory overrides disabled. Each container builds from its own root Dockerfile.
4. Deploy the branch or merge the PR after the environment variables and database migration below are ready.

The container images listen on port 80. The BFF and backend honor the `PORT` environment variable and bind to `0.0.0.0`.

### Vercel environment variables

Create the following variables in the Vercel project for Preview and Production:

- `JWT_ACCESS_SECRET`: a long, random secret.
- `JWT_REFRESH_SECRET`: a different long, random secret.
- `JWT_ACCESS_TTL_SECONDS=900`.
- `JWT_REFRESH_TTL_SECONDS=2592000`.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key, also used by the topic page's public Realtime channel. The frontend receives this public key and the project URL from the backend's `/api/realtime/config` endpoint; do not use the Supabase secret key here.
- `SUPABASE_API_SECRET`: the existing independent secret used only by the Nexus database RPCs.
- `SUPABASE_STORAGE_SECRET_KEY`: a separate Supabase server-side Secret API key used by the backend for Storage operations and to publish forum-topic change events to Realtime. Create it under Supabase Project Settings → API Keys. Do not use `SUPABASE_API_SECRET` here.
- `CRON_SECRET`: a long random value shared by the BFF and backend to authenticate the daily cleanup cron.

The TTL values must match on the BFF and backend because they control token validity and cookie lifetime. `AUTH_RATE_LIMIT_SECRET` is optional; when configured, it provides a dedicated HMAC key for authentication rate-limit bucket identifiers. If omitted, the backend derives those identifiers from `JWT_REFRESH_SECRET`. Forum topic broadcasts carry only a change notification; the topic's content is always loaded through the existing authorized backend API. Environment variables must not use a `VITE_` prefix. The Supabase publishable key is not a secret; the API secret and JWT secrets must be stored as sensitive values in Vercel and must never be committed or included in the frontend bundle.

### Persistent storage

All environments use `SupabaseRelationalRepository`. Account, profile, community, relationship, post, message, forum, upload and token data are persisted as normalized PostgreSQL rows.

For a fresh database, apply the numbered SQL files in ascending order. Migration `006_repair_missing_collection_rpcs.sql` is a recovery script for the transitional JSONB storage: it restores the legacy collection RPCs when they are missing and must run before migration 007. Production environments may record the equivalent recovery under a timestamped migration name, so check the Supabase migration history before replaying historical SQL. Do not run migration 006 after migration 042 has removed the JSONB collection table.

1. `001`–`005` establish the transitional Nexus storage, private backend access, upload buckets and initial collection RPCs; `006` restores missing transitional collection RPCs when required.
2. `007_relational_social_schema.sql` creates normalized account/social/media tables and transfers the existing records.
3. `008`–`041` add relational indexes, feed projection and triggers, targeted transactional writes, SQL-side page queries, search, pagination and integrity guards.
4. `042_retire_json_collection_storage.sql` removes the obsolete JSONB collection table and its legacy RPCs.
5. `043_remove_generic_relational_commit.sql` removes the compatibility RPC used by generic snapshot transactions.
6. `044_drop_legacy_relational_synchronizer.sql` removes the obsolete JSONB-to-relational synchronizer.
7. `045`–`048` preserve attached editor images, reconcile orphaned attachments and avatars, recover legacy cleanup claims, and prevent stale cleanup workers from deleting media still attached to live content.
8. `049_harden_community_membership_versioning.sql` serializes community membership and ownership changes with relational collection-version locks.
9. `050` and `057` fix ambiguous SQL column references in post/message and forum write RPCs; `051` permits empty entity-directory searches; `052` adds a short refresh-token rotation grace window for concurrent BFF requests.
10. `053`–`054` include suggested communities in `/auth/me` and expand the home suggestions projection to the 4×4 grid (up to sixteen entries).
11. `055_activity_notification_reads.sql` persists notification read state, and `056_active_profile_activity_feed.sql` scopes the feed to the active profile.
12. `058_logical_deletion_and_exclusive_profiles.sql` applies the complete profile/account lifecycle atomically: exclusive profile ownership, logical deletion and cascades, explicit active-profile clearing, feed/read-state tombstones, and retained media metadata for asynchronous Storage cleanup.
13. `059_harden_soft_delete_read_state_access.sql` changes notification read-state RPCs to `SECURITY INVOKER`, grants only the required backend insert privilege under the server-only RLS policy, and indexes the activity foreign key.
14. `060_allow_server_soft_delete_tombstones.sql` corrects restrictive RLS checks so authorized backend soft-delete writes can persist tombstones.
15. `061_refresh_tokens_physical_deletion.sql` makes refresh-token revocation and account-deletion cascades physically delete credentials rather than tombstone them.
16. `062_remove_refresh_token_tombstone_state.sql` removes the obsolete refresh-token tombstone column and cascade behavior.
17. `063_auth_rate_limits.sql` (introduced with the authentication-hardening change) creates a private shared rate-limit table and server-authorized RPC.
18. `064_require_active_account_for_refresh_token.sql` serializes refresh-token issuance against account deletion and rejects token issuance for missing or tombstoned accounts.
19. `065_fix_refresh_token_issue_lock_order.sql` keeps expired-token cleanup ahead of account-row locking during refresh-token issuance, matching the account-deletion lock order and avoiding a token/account deadlock. Apply migrations `063`–`065` before deploying the authentication-hardening backend code.
20. `066_harden_private_community_read_membership_type.sql` requires a private-community membership profile to match the community's effective owner-inherited type before forum or member-list reads are authorized.
21. `067_harden_private_community_metadata_reads.sql` applies the same owner-inherited profile-type check to community detail/edit/composer reads and private editor-image delivery.
22. `068_harden_managed_communities_profile_type.sql` requires the manager's owned profile to match the community's effective type in both managed-community count and result queries.
23. `069_private_community_avatars.sql` creates a dedicated private bucket for community avatars and updates community upload/read RPCs; profile avatars remain in the public profile bucket.
24. `070_prevent_refresh_cleanup_deadlocks.sql` makes expired refresh-token cleanup skip rows locked by concurrent account deletion.
25. `071_limit_managed_image_file_size.sql` sets the Storage file-size ceiling to 1 MiB for all three managed image buckets.
26. `072_activity_notification_read_scope.sql` validates notification read-state IDs against the full active-profile feed visibility rules, rather than limiting validation to the first 51 feed entries.
27. `073_auth_rate_limit_invoker_rls.sql` converts the auth rate-limit RPC to `SECURITY INVOKER` and grants only the necessary table operations under the backend-secret RLS policy.
28. `074_revoke_client_access_to_internal_jobs.sql` removes `PUBLIC`, `anon` and `authenticated` table privileges from the internal jobs/prospects state tables and restricts their SQL/trigger helper execution to `service_role`.
29. `075_opt_in_public_default_privileges.sql` removes inherited `PUBLIC`, `anon` and `authenticated` privileges from future tables, sequences and functions created by `postgres` in `public`; it also removes PostgreSQL's global default `PUBLIC EXECUTE` for future functions created by `postgres` (schema-local revokes cannot subtract that global default). Later migrations must explicitly grant only what each object needs.
30. `076_revoke_elevated_client_table_privileges.sql` removes `TRUNCATE`, `REFERENCES`, `TRIGGER` and `MAINTAIN` from `PUBLIC`, `anon` and `authenticated` on existing public tables, preserving ordinary row operations and `service_role` grants.
31. `077_revoke_unused_authenticated_role_access.sql` removes the unused Supabase `authenticated` role's existing grants on public tables, sequences and functions; it also revokes client access to the worker-only automation sequence. The BFF continues using `anon`.

Migrations `068`–`077` are present in this branch but have not been applied to production. Validate them against an isolated development database and apply them in numeric order before deploying the code that depends on them.

The migrations leave the existing tracker tables and their migration history untouched. User-facing data deletion is logical: records and dependent content receive `deleted_at_ms`, remain available as retained history, and are excluded from normal reads. Profiles have exactly one account owner; there is no profile-sharing or unlink-only ownership state. Relationships, forum/message content, account/profile settings, notification read states and feed projection rows also retain tombstones. Storage objects are removed asynchronously after being marked for deletion, while their database metadata remains as a tombstone. The feed remains a derived projection, but removing a feed item does not erase its stored deletion history. The production domain data lives in relational tables with primary keys, foreign keys, uniqueness constraints and row-level security. The `private` schema contains the backend-header validation helper used by internal database RPCs; it is not exposed through the Data API. The database stores only the SHA-256 hash of `SUPABASE_API_SECRET`. The small `public.nexus_collection_versions` table remains as concurrency metadata for atomic relational writes; it is not a domain-data store.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_API_SECRET`, and `SUPABASE_STORAGE_SECRET_KEY` on the backend service in Vercel. Configure `CRON_SECRET` on both the BFF and backend. The publishable key identifies the Supabase project; both API secrets, the cron secret, and the JWT secrets must remain sensitive environment variables and must never be bundled into the frontend.

### File uploads

The Supabase Storage setup uses three buckets: `nexus-avatars` is public and stores profile avatars; `nexus-community-avatars` is private and stores community avatars; `nexus-editor-images` is private and stores rich-text/editor images. All three accept JPEG, PNG, WebP, GIF and AVIF, with a maximum file size of 1 MiB and a maximum edge length of 1,024 px. The backend validates MIME signatures and image dimensions at upload completion and again when serving managed images; Storage also enforces the 1 MiB file-size ceiling through migration 071. Community avatars are served through an authorization-checked backend endpoint rather than a public Storage URL. The backend issues short-lived signed upload URLs, and the browser uploads directly to Storage. No Storage secret is sent to the browser.

Editor image references are stored in sanitized HTML as Nexus upload routes. Unattached editor images expire after 24 hours. When an image is attached to content, its upload expiry is suspended; if the attachment is removed, a new 24-hour orphan-cleanup window starts. Access to message images is checked against the sender/recipient profiles; images attached to public profile/community About content are publicly readable through the backend, while private-community content follows membership permissions. A daily Vercel Cron removes expired objects and abandoned avatar uploads. The scheduled cleanup runs at 04:00 UTC; physical deletion may happen after the access deadline, but expired unattached images are already inaccessible.

`SUPABASE_STORAGE_SECRET_KEY` is separate from `SUPABASE_API_SECRET`: the latter authenticates internal relational database RPCs. Never expose either secret in frontend environment variables or send it from the browser.

The only application database is Supabase PostgreSQL. Accounts and account-profile links, preferences, profiles, communities, profile/community relationships, posts, settings, messages, forum topics/replies, refresh tokens and media files are stored as normalized rows. Page reads use SQL-side joins and filtering; the feed uses a typed `feed_activities` projection maintained by database triggers and keyset pagination. Writes use targeted transactional database RPCs with ownership, visibility and integrity checks. The obsolete JSONB `nexus_collections` snapshot table and its legacy RPCs are removed by migration 042; migration 043 removes the generic snapshot-commit RPC. The `nexus_collection_versions` table remains only as concurrency metadata for targeted relational writes. The Supabase adapter exposes targeted operations; its generic collection read/update/transaction methods fail closed and never access the database. Compatibility callbacks remain only for in-memory service test doubles. `StorageModule` always selects Supabase and verifies every targeted repository capability before the backend starts. There is no JSON-file database adapter.

## Optional Docker Compose deployment

For local testing or a Docker host, `compose.yaml` runs the frontend, BFF and backend together and connects the backend to the same required Supabase relational database. It exposes only the frontend; PostgreSQL data remains in Supabase rather than a local JSON volume. This is an alternative deployment target; it is not used by the Vercel Services deployment.

```bash
cp .env.compose.example .env
# Replace both JWT secrets with different random values.
docker compose up --build -d
```

Open http://localhost:8080 by default.

## Authentication

The backend issues separate access and refresh JWTs. The access token defaults to 15 minutes; the refresh token defaults to 30 days and rotates after use. The BFF stores them in HttpOnly cookies, forwards the access token to the backend and automatically refreshes expired sessions. Browser JavaScript does not receive either token.

Passwords remain hashed with PBKDF2-SHA256 using 310,000 iterations and the same base64 salt/hash representation used by the previous frontend, so existing password hashes remain compatible once account records are imported. Sign-in attempts are limited to 15 per client IP per 15-minute window; sign-up attempts are limited to 5 per client IP per hour. The BFF forwards Vercel's client-address header and the backend stores only an HMAC hash of each route/IP bucket. The database migration for this limiter must be applied before deploying the code that calls it.

## Pagination

Paginated views keep `page` and `pageSize` in the URL. Community member moderation has a separate `pendingPage` parameter for the pending-request list. Frontend requests send a structured Axios `params` object; the BFF forwards `req.query` as Axios params, and the backend validates/clamps the pagination values.

## Existing browser data

This refactor removes normal application persistence from browser storage. Existing localStorage/sessionStorage records are not automatically imported into backend storage; import should be performed as a deliberate one-time migration before removing the old browser data from any environment that contains important records.


## Profile selection

Authenticated users can open `/my-profiles` at any time to manage only the profiles owned by their account. The page uses the paginated owned-profile endpoint and supports selecting, duplicating and logically deleting profiles. Deleting the active profile clears the account's active-profile reference; opening `/home` without an active profile redirects to `/my-profiles`. A session with profiles but no explicitly selected current profile remains unselected until the user chooses one. The account dropdown and its profile switcher remain unchanged.

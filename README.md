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

The default Vite development server proxies `/api` to the local BFF. Without Supabase variables, the backend uses the JSON file adapter locally.

### Use the production BFF with the local frontend

To run only the frontend while sending API requests to the production BFF:

```bash
npm run dev:front:prod-bff
```

Open http://localhost:5173. The Vite server proxies `/api` to `https://nexus2-yoggsaras-projects.vercel.app`; browser requests remain same-origin with localhost, so the BFF's HttpOnly session cookies are stored for the local development host instead of requiring a direct cross-origin request. This mode does not start the local BFF or backend and does not require their `.env` files.

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

The TTL values must match on the BFF and backend because they control token validity and cookie lifetime. Forum topic broadcasts carry only a change notification; the topic's content is always loaded through the existing authorized backend API. Environment variables must not use a `VITE_` prefix. The Supabase publishable key is not a secret; the API secret and JWT secrets must be stored as sensitive values in Vercel and must never be committed or included in the frontend bundle.

### Persistent storage

All environments use `SupabaseRelationalRepository`. Account, profile, community, relationship, post, message, forum, upload and token data are persisted as normalized PostgreSQL rows.

Apply every SQL file in `apps/back/sql` in ascending filename order. Migration 006 is intentionally absent.

1. `001`–`005` establish the transitional Nexus storage, private backend access, upload buckets and initial collection RPCs.
2. `007_relational_social_schema.sql` creates normalized account/social/media tables and transfers the existing records.
3. `008`–`041` add relational indexes, feed projection and triggers, targeted transactional writes, SQL-side page queries, search, pagination and integrity guards.
4. `042_retire_json_collection_storage.sql` removes the obsolete JSONB collection table and its legacy RPCs.
5. `043_remove_generic_relational_commit.sql` removes the compatibility RPC used by generic snapshot transactions.

The migrations leave the existing tracker tables and their migration history untouched. The production domain data lives in relational tables with primary keys, foreign keys, uniqueness constraints and row-level security. The `private` schema contains the backend-header validation helper used by internal database RPCs; it is not exposed through the Data API. The database stores only the SHA-256 hash of `SUPABASE_API_SECRET`. The small `public.nexus_collection_versions` table remains as concurrency metadata for atomic relational writes; it is not a domain-data store.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_API_SECRET`, and `SUPABASE_STORAGE_SECRET_KEY` on the backend service in Vercel. Configure `CRON_SECRET` on both the BFF and backend. The publishable key identifies the Supabase project; both API secrets, the cron secret, and the JWT secrets must remain sensitive environment variables and must never be bundled into the frontend.

### File uploads

The Supabase Storage setup uses two buckets: `nexus-avatars` is public and stores profile/community avatars permanently (up to 5 MB per image); `nexus-editor-images` is private and stores editor images (up to 10 MB). Both accept JPEG, PNG, WebP, GIF and AVIF. The backend issues short-lived signed upload URLs, and the browser uploads directly to Storage. No Storage secret is sent to the browser.

Editor image references are stored in sanitized HTML as Nexus upload routes. Access to message images is checked against the sender/recipient profiles; images attached to public profile/community About content are publicly readable through the backend. Access is denied at exactly 24 hours after upload. A daily Vercel Cron removes expired objects and abandoned avatar uploads. The scheduled cleanup runs at 04:00 UTC; physical deletion may happen after the access deadline, but expired images are already inaccessible.

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

Passwords remain hashed with PBKDF2-SHA256 using 310,000 iterations and the same base64 salt/hash representation used by the previous frontend, so existing password hashes remain compatible once account records are imported.

## Pagination

Paginated views keep `page` and `pageSize` in the URL. Community member moderation has a separate `pendingPage` parameter for the pending-request list. Frontend requests send a structured Axios `params` object; the BFF forwards `req.query` as Axios params, and the backend validates/clamps the pagination values.

## Existing browser data

This refactor removes normal application persistence from browser storage. Existing localStorage/sessionStorage records are not automatically imported into backend storage; import should be performed as a deliberate one-time migration before removing the old browser data from any environment that contains important records.

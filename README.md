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
- `SUPABASE_STORAGE_SECRET_KEY`: a separate Supabase server-side Secret API key used by the backend for Storage operations. Create it under Supabase Project Settings → API Keys. Do not use `SUPABASE_API_SECRET` here.
- `CRON_SECRET`: a long random value shared by the BFF and backend to authenticate the daily cleanup cron.

The TTL values must match on the BFF and backend because they control token validity and cookie lifetime. Forum topic broadcasts carry only a change notification; the topic's content is always loaded through the existing authorized backend API. Environment variables must not use a `VITE_` prefix. The Supabase publishable key is not a secret; the API secret and JWT secrets must be stored as sensitive values in Vercel and must never be committed or included in the frontend bundle.

### Persistent storage

Vercel container instances are ephemeral, so the backend does not use its JSON file adapter in production. It uses the Supabase REST API to read and upsert the Nexus collection table.

Apply the SQL files in order against the Supabase project:

1. `apps/back/sql/001_nexus_collections.sql` creates only Nexus-prefixed storage objects and the backend credential hash.
2. `apps/back/sql/002_nexus_collection_private_rls.sql` removes the initial public RPC functions, adds a private header-validation helper, and enables narrowly scoped RLS policies.
3. `apps/back/sql/003_nexus_storage_buckets.sql` creates the permanent public avatar bucket and temporary private editor-image bucket.
4. `apps/back/sql/004_atomic_collection_transactions.sql` adds the authenticated, atomic multi-collection commit function used by profile and community creation.
5. `apps/back/sql/005_selective_collection_reads.sql` adds an RLS-protected, security-invoker RPC that returns only records matching requested IDs.

The migrations do not modify the existing tracker tables or migrations. The `public.nexus_collections` table has RLS enabled. The `anon` role can reach only the collection operations that pass the RLS helper check, which reads the backend-only `x-nexus-api-secret` HTTP header. The helper lives in the unexposed `private` schema; no public `SECURITY DEFINER` RPC is left for the application. The database stores only the SHA-256 hash of the API secret.

Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_API_SECRET`, and `SUPABASE_STORAGE_SECRET_KEY` on the backend service in Vercel. Configure `CRON_SECRET` on both the BFF and backend. The publishable key identifies the Supabase project; both API secrets, the cron secret, and the JWT secrets must remain sensitive environment variables and must never be bundled into the frontend.

### File uploads

The Supabase Storage setup uses two buckets: `nexus-avatars` is public and stores profile/community avatars permanently (up to 5 MB per image); `nexus-editor-images` is private and stores editor images (up to 10 MB). Both accept JPEG, PNG, WebP, GIF and AVIF. The backend issues short-lived signed upload URLs, and the browser uploads directly to Storage. No Storage secret is sent to the browser.

Editor image references are stored in sanitized HTML as Nexus upload routes. Access to message images is checked against the sender/recipient profiles; images attached to public profile/community About content are publicly readable through the backend. Access is denied at exactly 24 hours after upload. A daily Vercel Cron removes expired objects and abandoned avatar uploads. The scheduled cleanup runs at 04:00 UTC; physical deletion may happen after the access deadline, but expired images are already inaccessible.

`SUPABASE_STORAGE_SECRET_KEY` is separate from `SUPABASE_API_SECRET`: the latter continues to protect only the private Nexus collection table. Never expose either secret in frontend environment variables or send it from the browser.

The production adapter stores each domain collection as one JSONB array. Mutations still read and write the full collection and remain a scaling limitation. ID-based lookups can use the selective-read RPC introduced by migration 005 to return only matching records, reducing response size and backend decoding. PostgreSQL still enumerates the JSONB array to find those records, so this does not remove the database-side scan; row-level domain storage and server-side pagination remain pending. Single-collection changes use optimistic compare-and-swap; multi-collection transactions use the PostgreSQL function introduced by migration 004, which checks every collection version and commits all changes in one database transaction. Profile creation (profile + account link) and community creation (community + owner membership) use this path. Database-level uniqueness constraints, row-level domain storage and server-side pagination are still pending; normalize the collections before substantial traffic.

The local JSON adapter serializes transactions within the Node.js process and restores already-replaced files if a write fails. It is a development fallback, not a multi-process or crash-atomic production database.

## Optional Docker Compose deployment

For local testing or a Docker host, `compose.yaml` still runs the frontend, BFF and backend together. It exposes only the frontend and persists JSON files in the `nexus-data` volume. This is an alternative deployment target; it is not used by the Vercel Services deployment.

```bash
cp .env.compose.example .env
# Replace both JWT secrets with different random values.
docker compose up --build -d
```

Open http://localhost:8080 by default. Do not use `docker compose down -v` unless you intend to delete the persisted data.

## Authentication

The backend issues separate access and refresh JWTs. The access token defaults to 15 minutes; the refresh token defaults to 30 days and rotates after use. The BFF stores them in HttpOnly cookies, forwards the access token to the backend and automatically refreshes expired sessions. Browser JavaScript does not receive either token.

Passwords remain hashed with PBKDF2-SHA256 using 310,000 iterations and the same base64 salt/hash representation used by the previous frontend, so existing password hashes remain compatible once account records are imported.

## Pagination

Paginated views keep `page` and `pageSize` in the URL. Community member moderation has a separate `pendingPage` parameter for the pending-request list. Frontend requests send a structured Axios `params` object; the BFF forwards `req.query` as Axios params, and the backend validates/clamps the pagination values.

## Existing browser data

This refactor removes normal application persistence from browser storage. Existing localStorage/sessionStorage records are not automatically imported into backend storage; import should be performed as a deliberate one-time migration before removing the old browser data from any environment that contains important records.

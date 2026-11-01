# Nexus monorepo

## Workspaces

- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies, token refresh and HTTP forwarding.
- `apps/back`: NestJS domain API. Owns authentication, authorization, validation, domain services and persistence.
- `packages/common`: shared domain models, DTO contracts and pagination types.

The three applications are deployed together in one Vercel project using Vercel Services. The BFF is the only public API service; the domain backend remains private and is reached through a Vercel service binding.

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

The Vite development server proxies `/api` to the BFF. Without Supabase variables, the backend uses the JSON file adapter locally.

## Deployment on Vercel

The root `vercel.json` defines three services in one Vercel project:

| Service | Root | Public access |
| --- | --- | --- |
| `front` | `apps/front` | All non-API routes |
| `bff` | `apps/bff` | `/api/*` |
| `back` | `apps/back` | Private; BFF service binding only |

The BFF receives `BACKEND_SERVICE_URL` from the Vercel binding and appends the backend's `/api` prefix. The browser never receives a backend URL or database credential. No public `VITE_BFF_URL` is needed: the frontend calls the same-origin `/api` path.

### Vercel project settings

1. Keep the project's Root Directory at the repository root (`.`).
2. Set Framework Preset to **Services** in Build & Development Settings. This is required; a `services` object in `vercel.json` alone does not switch the project to Services mode.
3. Keep project-level Install Command, Build Command and Output Directory overrides disabled. Each service owns its build settings.
4. Deploy the branch or merge the PR after the environment variables and database schema below are ready.

Vercel builds the three service roots separately. Each workspace runs the shared `@nexus/common` build as a `prebuild` step.

### Backend environment variables

Configure these only for the backend service, in the Vercel project's environment-variable settings:

- `JWT_ACCESS_SECRET`: a long, random secret.
- `JWT_REFRESH_SECRET`: a different long, random secret.
- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key.

Set `JWT_ACCESS_TTL_SECONDS=900` and `JWT_REFRESH_TTL_SECONDS=2592000` on both backend and BFF so token expiry and cookie lifetime stay aligned.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable or add it to the frontend/BFF. It has privileged server-side access and must stay on the backend service.

### Persistent storage

Vercel Functions do not provide a persistent application filesystem. When `VERCEL` is set, the backend therefore refuses to start without the Supabase variables instead of silently writing account data to temporary disk.

The Supabase adapter uses the existing repository contract and stores each current collection as a JSONB array in `public.nexus_collections`. This keeps the current domain services intact while moving persistence out of the function filesystem.

To create the table, run the SQL in `apps/back/sql/001_nexus_collections.sql` once in the Supabase SQL Editor. The table has RLS enabled, denies access to the `anon` and `authenticated` roles, and grants access only to `service_role`. The service-role key remains server-only.

This is an initial persistent adapter, not a normalized relational schema. The current repository interface replaces whole collections on write, so concurrent writes to the same collection can overwrite one another. Before substantial traffic or concurrent write workloads, move the domain collections to normalized tables and transactional repository operations.

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

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
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key.
- `SUPABASE_API_SECRET`: an independent random secret used only by the Nexus database RPCs.

The TTL values must match on the BFF and backend because they control token validity and cookie lifetime. Environment variables must not use a `VITE_` prefix. The Supabase publishable key is not a secret; the API secret and JWT secrets must be stored as sensitive values in Vercel and must never be committed or included in the frontend bundle.

### Persistent storage

Vercel container instances are ephemeral, so the backend does not use its JSON file adapter in production. It uses the Supabase REST API to call two narrowly scoped RPC functions, `nexus_read_collection` and `nexus_write_collection`.

Run `apps/back/sql/001_nexus_collections.sql` once against the Supabase project. It adds only Nexus-prefixed objects: `public.nexus_collections`, a private credential table and two RPC functions. It does not modify the existing tracker tables or migrations. The collection table has RLS enabled and no direct access for `anon` or `authenticated`; the public RPC functions validate the backend-only secret before reading or writing data. The database stores only the SHA-256 hash of that secret.

The current repository contract replaces whole JSONB collections on write, so concurrent writes to the same collection can overwrite one another. This adapter keeps the current domain services working without filesystem persistence; before substantial traffic, normalize the collections and move write operations to transactional row-level operations.

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

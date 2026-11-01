# Nexus monorepo

## Workspaces

- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies, token refresh and HTTP forwarding.
- `apps/back`: NestJS domain API. Owns authentication, authorization, validation, domain services and persistence.
- `packages/common`: shared domain models, DTO contracts and pagination types.

All three applications live in this repository. They are built and deployed together through the root Docker Compose stack; they do not need separate repositories or public API URLs.

## Development

Requires Node.js 22.22+ and npm workspaces.

```bash
npm ci
cp apps/back/.env.example apps/back/.env
cp apps/bff/.env.example apps/bff/.env
npm run dev
```

Front: http://localhost:5173  
BFF: http://localhost:3001  
Back: http://localhost:3002

The Vite development server proxies `/api` to the BFF.

## Deployment (one stack)

The root `compose.yaml` starts all three applications from this monorepo:

- The frontend is the only publicly exposed service.
- Nginx forwards `/api` to the BFF over the private Compose network.
- The BFF forwards domain requests to the backend over that same private network.
- The backend's JSON files are stored in the named `nexus-data` volume.

No public `VITE_BFF_URL`, BFF URL, or backend URL is needed for this deployment. The browser uses the same origin for pages and API requests.

### Start locally or on a Docker host

```bash
cp .env.compose.example .env
```

Replace both JWT secrets in `.env` with different, randomly generated values. For example, run `openssl rand -base64 48` twice and use one result for each secret.

Then start the complete stack:

```bash
docker compose up --build -d
```

Open `http://localhost:8080` by default. Change `HTTP_PORT` in `.env` to expose another host port.

For a remote deployment, use a host with Docker Engine, the Docker Compose plugin, and persistent volumes. Set `FRONTEND_ORIGIN` to the exact public HTTPS origin, and terminate TLS at the host's reverse proxy or platform ingress. Deploy from the repository root so Compose can build each workspace using the shared lockfile.

The root `vercel.json` is a frontend-only static build configuration. Vercel's static deployment does not run this Compose stack or the long-lived NestJS services. Use the Compose deployment when the frontend, BFF, and backend must run together under one public origin.

### Persistent data

The backend stores JSON collections in `DATA_DIRECTORY`, mounted to the named `nexus-data` volume by Compose. The volume survives container rebuilds and restarts. Do not run multiple backend replicas against this JSON adapter: it does not provide transactions, multi-process locking, or shared-storage coordination. Back up the volume, and do not use `docker compose down -v` unless you intend to delete account data.

The JSON adapter is temporary while a free database is selected. The repository interface isolates persistence from domain services so a database adapter can replace it without changing the API contracts.

## Authentication

The backend issues separate access and refresh JWTs. The access token defaults to 15 minutes; the refresh token defaults to 30 days and rotates after use. The BFF stores them in HttpOnly cookies, forwards the access token to the backend and automatically refreshes expired sessions. Browser JavaScript does not receive either token.

Passwords remain hashed with PBKDF2-SHA256 using 310,000 iterations and the same base64 salt/hash representation used by the previous frontend, so existing password hashes remain compatible once account records are imported.

## Pagination

Paginated views keep `page` and `pageSize` in the URL. Community member moderation has a separate `pendingPage` parameter for the pending-request list. Frontend requests send a structured Axios `params` object; the BFF forwards `req.query` as Axios params, and the backend validates/clamps the pagination values.

## Existing browser data

This refactor removes normal application persistence from browser storage. Existing localStorage/sessionStorage records are not automatically imported into the backend JSON files; import should be performed as a deliberate one-time migration before removing the old browser data from any environment that contains important records.

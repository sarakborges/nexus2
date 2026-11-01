# Nexus monorepo

## Workspaces

- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies, token refresh and HTTP forwarding.
- `apps/back`: NestJS domain API. Owns authentication, authorization, validation, domain services and persistence.
- `packages/common`: shared domain models, DTO contracts and pagination types.

## Development

Requires Node.js 22.22+ and npm workspaces.

```bash
npm install
cp apps/back/.env.example apps/back/.env
cp apps/bff/.env.example apps/bff/.env
npm run dev
```

Front: http://localhost:5173  
BFF: http://localhost:3001  
Back: http://localhost:3002

The Vite development server proxies `/api` to the BFF. When deploying the static frontend separately, set `VITE_BFF_URL` to the public BFF base URL at build time.

## Persistence

The backend currently writes JSON collections under `DATA_DIRECTORY` (default: `apps/back/data` when started from that workspace). This is a temporary adapter while a free database is selected. The repository interface isolates persistence from domain services so a database adapter can replace it without changing the API contracts.

The JSON adapter uses atomic file replacement, but it is intended only for development or a single application instance with persistent disk. It does not provide database transactions, multi-process locking, or shared storage for horizontal scaling. Do not deploy it as a multi-instance production database.

## Authentication

The backend issues separate access and refresh JWTs. The access token defaults to 15 minutes; the refresh token defaults to 30 days and rotates after use. The BFF stores them in HttpOnly cookies, forwards the access token to the backend and automatically refreshes expired sessions. Browser JavaScript does not receive either token.

Passwords remain hashed with PBKDF2-SHA256 using 310,000 iterations and the same base64 salt/hash representation used by the previous frontend, so existing password hashes remain compatible once account records are imported.

## Pagination

Paginated views keep `page` and `pageSize` in the URL. Community member moderation has a separate `pendingPage` parameter for the pending-request list. Frontend requests send a structured Axios `params` object; the BFF forwards `req.query` as Axios params, and the backend validates/clamps the pagination values.

## Existing browser data

This refactor removes normal application persistence from browser storage. Existing localStorage/sessionStorage records are not automatically imported into the backend JSON files; import should be performed as a deliberate one-time migration before removing the old browser data from any environment that contains important records.

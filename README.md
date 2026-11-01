# Nexus monorepo

## Workspaces
- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies and forwards requests.
- `apps/back`: NestJS domain API. Owns validation, authorization, JWT issuance and persistence.
- `packages/common`: shared TypeScript contracts and types.

## Development
Node.js 22.22+ and npm workspaces are required.

```bash
npm install
cp apps/back/.env.example apps/back/.env
cp apps/bff/.env.example apps/bff/.env
npm run dev
```

Front: http://localhost:5173 · BFF: http://localhost:3001 · Back: http://localhost:3002

The front calls only the BFF. The BFF stores access and refresh JWTs in HttpOnly cookies and forwards API requests to the back. The back uses JSON files under `DATA_DIRECTORY` as a temporary persistence adapter while a free database is selected. This adapter is intended for local development or a single-instance deployment with persistent disk; it is not a shared store for horizontally scaled production instances.

## Authentication
Access tokens default to 15 minutes. Refresh tokens default to 30 days and rotate when used. Configure different random secrets for access and refresh signing. Tokens are HttpOnly cookies and are not exposed to browser JavaScript.

## Pagination
Paginated endpoints accept `page` and `pageSize` as query parameters. The front mirrors these values in the URL and sends them to the BFF through Axios `params`, rather than manually concatenating a query string.

# Nexus monorepo

## Workspaces

- `apps/front`: React + Vite client.
- `apps/bff`: NestJS Backend-for-Frontend. Owns browser session cookies and forwards HTTP requests.
- `apps/back`: NestJS domain API. Owns authentication, authorization, validation, domain services and persistence.
- `packages/common`: shared domain types and API contracts.

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

The frontend communicates only with the BFF. The BFF stores access and refresh JWTs in HttpOnly cookies and forwards requests to the domain API. The backend temporarily persists records as JSON files under `DATA_DIRECTORY` while a free database is selected. This adapter is intended for local development or a single instance with persistent disk; it is not suitable as shared storage for horizontally scaled production instances.

## Authentication

Access JWTs default to 15 minutes. Refresh JWTs default to 30 days and rotate when used. Configure different long random secrets for both token types. Tokens are kept in HttpOnly cookies and are not exposed to browser JavaScript. Password hashing remains PBKDF2-SHA256 with 310,000 iterations to retain compatibility with existing account hashes.

## Pagination

Paginated views reflect `page` and `pageSize` in the current URL. API calls pass these values through Axios' `params` option; the BFF forwards the query parameter object to the backend. No query strings are manually concatenated in the frontend.

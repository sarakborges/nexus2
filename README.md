# Nexus

Nexus is a React application built with Vite and TypeScript.

## Requirements

- Node.js 22.22 or later
- npm

## Getting started

```bash
npm install
npm run dev
```

## Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build in `build/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run prettier` | Format the project with Prettier |

## Project structure

```
src/
  pages/
    HomePage/
      index.tsx
  routes/
    index.tsx
  styles/
    main.scss
  App.tsx
  main.tsx
public/
```

Client-side navigation is configured with React Router in declarative mode. Add route definitions in `src/routes/index.tsx`.

## Deployment

- **Vercel:** the project outputs static files to `build/`; `vercel.json` rewrites application paths to `index.html`.
- **Docker:** the included Dockerfile builds the app and serves it with Nginx. Nginx is configured to fall back to `index.html` for client-side routes.

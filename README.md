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
  Assets/
    Themes/
    main.css
    reset.css
    vars.css
  DesignSystem/
    Atoms/
    Molecules/
    Organisms/
  Components/
    Atoms/
    Molecules/
    Organisms/
  Helpers/
    Language/
    Math/
    Systems/
  Locales/
    En/
  pages/
    HomePage/
      index.tsx
  routes/
    index.tsx
  App.tsx
  main.tsx
public/
  languages/
```

Both `DesignSystem` and `Components` follow Atomic Design. The design system contains application-independent visual primitives and compositions; application components compose those primitives into feature-specific controls and interface sections. Each area documents its layer boundaries in its own README.

React Router is configured in declarative mode. Add route definitions in `src/routes/index.tsx`.

Localization strings live in `src/Locales/` and are accessed through `src/Helpers/Language`. Generic browser persistence helpers use the `nexus_` storage namespace.

## Deployment

- **Vercel:** the project outputs static files to `build/`; `vercel.json` rewrites application paths to `index.html`.
- **Docker:** the included Dockerfile builds the app and serves it with Nginx. Nginx is configured to fall back to `index.html` for client-side routes.

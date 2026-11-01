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
  Components/
    Atoms/
    Molecules/
    Organisms/
  Constants/
  DesignSystem/
    Atoms/
    Molecules/
  Helpers/
    Language/
    Math/
    Systems/
      Data/
      Storage/
  Hooks/
    Language/
  Locales/
    en-US.ts
    pt-BR.ts
  Stores/
  Types/
  pages/
    LandingPage/
    SignUpPage/
    SignInPage/
    HomePage/
    ProfilePage/
    NotFoundPage/
  routes/
    index.tsx
  App.tsx
  main.tsx
public/
  languages/
```

Both `DesignSystem` and `Components` follow Atomic Design. The design system contains application-independent visual primitives and compositions; application components compose those primitives into feature-specific controls and interface sections. Each area documents its layer boundaries in its own README.

React Router is configured in declarative mode. The initial routes are landing (`/`), sign-up (`/sign-up`), sign-in (`/sign-in`), home (`/home`) and profile (`/profile`); unknown paths render the empty `NotFoundPage`.

The application supports Brazilian Portuguese (`pt-BR`) and US English (`en-US`). Brazilian Portuguese is the default language. Localization strings live in `src/Locales/` and are accessed through the typed `useTranslations` hook. Generic browser persistence helpers use the `nexus_` storage namespace; settings use a dedicated Zustand persistence store.

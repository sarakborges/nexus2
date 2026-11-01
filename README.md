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
| `npm run storybook` | Start Storybook on port 6006 |
| `npm run build-storybook` | Build the static Storybook |

## User and profile models

The `User` model contains `id`, `email` and `password`. The password field stores a PBKDF2-derived verifier and salt rather than the original plain-text password. The authenticated session exposes only the user's `id` and `email`.

The `Profile` model is separate and contains `id`, `name`, `url`, `picture` and `about`. A user can have one profile. The prototype associates it with the user by storing it under a user-scoped `sessionStorage` key, keeping the requested profile model fields unchanged.

Sign-up creates only a user and starts a session. It then routes to `/getting-started`, which explains the profile setup step and links to `/create-profile`. Once a profile is created, the user is redirected to `/home`. On subsequent sign-ins, users with a profile go directly to home; users without one return to onboarding.

All users, profiles and sessions exist only in the current tab's `sessionStorage`. This is a client-side prototype, not production authentication or authorization. Browser storage can be inspected or modified; use a backend and database before relying on these records or protecting sensitive resources.

## Component development

Story files live beside their components in `*.stories.tsx` files. The Storybook catalog includes every Design System and application component. Use the Appearance toolbar to inspect stories with the light and dark themes; the accessibility addon checks rendered stories.

## Project structure

```
src/
  Assets/
    Themes/
      main.theme.css
      light.theme.css
      dark.theme.css
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
    Organisms/
  Helpers/
    Language/
    Math/
    Systems/
      Data/
      Storage/
  Hooks/
    Language/
    System/
    Theme/
  Locales/
    en-US.ts
    pt-BR.ts
  Models/
    User.model.ts
    Profile.model.ts
  Services/
    Auth/
    Profile/
  Stores/
  Types/
  pages/
    LandingPage/
    SignUpPage/
    SignInPage/
    GettingStartedPage/
    CreateProfilePage/
    HomePage/
    ProfilePage/
    NotFoundPage/
  routes/
    index.tsx
  App.tsx
  main.tsx
.storybook/
  main.ts
  preview.tsx
public/
  languages/
```

Both `DesignSystem` and `Components` follow Atomic Design. The design system contains application-independent visual primitives and compositions; application components compose those primitives into feature-specific controls and interface sections. Each area documents its layer boundaries in its own README.

The shared button atom uses the `variation` prop: `primary` (default), `secondary`, `cancel` and `transparent`. Overlapping feature-specific button primitives should not be created.

The modal is a controlled native `dialog`, allowing the browser to handle modal focus and keyboard behavior. Toast notifications dismiss themselves after 5,000 ms by default; the duration is configurable, and `0` disables auto-dismiss.

React Router is configured in declarative mode. Unknown paths render `NotFoundPage`.

The application supports Brazilian Portuguese (`pt-BR`) and US English (`en-US`). Both language and appearance default to the system preferences until the user chooses a value manually. The language hook resolves browser locales; the appearance hook follows `prefers-color-scheme`. Manual choices are persisted, and users can select the system preference again.

Theme tokens are split by responsibility: `main.theme.css` defines primary, secondary and semantic success/warning/error colors; `light.theme.css` and `dark.theme.css` override only appearance-dependent neutral, text, surface and border tokens. Brand and status colors remain stable across appearances.

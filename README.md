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

The `User` model contains `id`, `email`, `password`, `profiles` and `currentProfile`. The password field stores a PBKDF2-derived verifier and salt rather than the original plain-text password. The `profiles` field is an array of profile IDs owned by that user. `currentProfile` is the ID of the profile currently selected by the user, or `null` when the user has not created a profile.

The `Profile` model contains `id`, `name`, `url`, `picture`, `about` and `type`. The profile type is one of `social`, `rp` or `business`. The `url` field is a unique URL-safe profile slug, used by the public route `/profile/:url`.

Sign-up creates only a user and starts a session. It then routes to `/getting-started`, which explains profile setup and links to `/create-profile`. Creating a profile stores it in the global profile collection and adds its ID to the owner's `User.profiles` array. The first created profile becomes current automatically. Users can switch their current profile from Home; this updates `User.currentProfile` and the active session. Public profile pages can be viewed without signing in.

## State management

Zustand stores are the runtime source of truth for application state. `User.store.ts` keeps user records in memory and persists successful user changes to `localStorage`. `Profile.store.ts` holds only the single profile currently being viewed; it never caches the global profile collection. Profile lookup and creation use the profile service for targeted reads and writes. The Home page loads the signed-in user's profile summaries for that screen without promoting the complete profile collection to a global store.

`Auth.store.ts` coordinates the authenticated session with user-store mutations and persists the active session to `sessionStorage`. `Settings.store.ts` uses Zustand persistence for language and theme preferences. Services handle credential validation, profile validation and legacy-data migration; components consume store state rather than reading browser storage directly.

## Browser storage

Persistent application records use `localStorage`:
- `nexus_users`: user records, including password verifiers, profile ID arrays and the current profile ID.
- `nexus_profiles`: the persisted profile records.

Only the active authenticated session uses `sessionStorage` (`nexus_auth_session_v2`). The account and profiles remain available after closing the tab or browser; the active session is scoped to the current tab.

The migration reads user and profile records created by the earlier session-only prototype and moves them to the new local storage format. Legacy users with profiles but no current profile are assigned their first associated profile. Profiles without a type are migrated as `social`.

This is still a client-side prototype, not production authentication or authorization. Browser storage can be inspected or modified; use a backend and database before relying on these records or protecting sensitive resources.

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
    Auth.store.ts
    User.store.ts
    Profile.store.ts
    Settings.store.ts
    index.ts
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

React Router is configured in declarative mode. Unknown paths render `NotFoundPage`. Each route's `main` element uses a CSS entry animation; `prefers-reduced-motion` disables it, so page transitions require no JavaScript logic.

The application supports Brazilian Portuguese (`pt-BR`) and US English (`en-US`). Both language and appearance default to the system preferences until the user chooses a value manually. The language hook resolves browser locales; the appearance hook follows `prefers-color-scheme`. Manual choices are persisted, and users can select the system preference again.

Theme tokens are split by responsibility: `main.theme.css` defines primary, secondary and semantic success/warning/error colors; `light.theme.css` and `dark.theme.css` override only appearance-dependent neutral, text, surface and border tokens. Brand and status colors remain stable across appearances.

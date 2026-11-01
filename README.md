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
.storybook/
  main.ts
  preview.tsx
public/
  languages/
```

Both `DesignSystem` and `Components` follow Atomic Design. The design system contains application-independent visual primitives and compositions; application components compose those primitives into feature-specific controls and interface sections. Each area documents its layer boundaries in its own README.

The shared button atom uses the `variation` prop: `primary` (default), `secondary`, `cancel` and `transparent`. Overlapping feature-specific button primitives should not be created.

The modal is a controlled native `dialog`, allowing the browser to handle modal focus and keyboard behavior. Toast notifications dismiss themselves after 5,000 ms by default; the duration is configurable, and `0` disables auto-dismiss.

React Router is configured in declarative mode. Routes are landing (`/`), sign-up (`/sign-up`), sign-in (`/sign-in`), home (`/home`) and profile (`/profile`); unknown paths render `NotFoundPage`.

The application supports Brazilian Portuguese (`pt-BR`) and US English (`en-US`). Both language and appearance default to the system preferences until the user chooses a value manually. The language hook resolves browser locales; the appearance hook follows `prefers-color-scheme`. Manual choices are persisted, and users can select the system preference again.

Theme tokens are split by responsibility: `main.theme.css` defines primary, secondary and semantic success/warning/error colors; `light.theme.css` and `dark.theme.css` override only appearance-dependent neutral, text, surface and border tokens. Brand and status colors remain stable across appearances.

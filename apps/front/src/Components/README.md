# Application Components

Application components follow Atomic Design and compose the shared design system.

- **Atoms** are the smallest independently useful UI primitives. They do not compose other application components; examples include avatars, flags, identity markers and small feedback or toolbar elements.
- **Molecules** combine atoms into focused controls or repeatable content units, such as identity links, option rows, list entries and action groups.
- **Organisms** compose molecules into complete interface sections with a clear feature responsibility, such as directories, editors, menus and settings sections.
- **Templates** arrange organisms into reusable page-level layouts without owning route orchestration.

## Component boundaries

- Every component has its own directory directly under its Atomic Design layer. Classify by composition and responsibility, not by file length or naming alone.
- A component directory contains exactly one `.component.tsx` implementation.
- A component must never be nested inside another component's directory. Components composed by a parent are siblings in the appropriate layer, not subcomponents stored under that parent.
- Styles, types, hooks, stories and utilities that belong to a component stay in that component's directory.
- `pages` contains route-level page components and page orchestration. Feature UI components must live in `Atoms`, `Molecules`, `Organisms` or `Templates`, even when used by only one page.
- Route guards and other routing infrastructure remain under `routes`; they are not Atomic Design UI components.

Keep domain behavior in application components and helpers. Import presentation primitives from `@/DesignSystem`; never import application components into the design system.

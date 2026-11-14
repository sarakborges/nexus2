# Application Components

Application components follow Atomic Design and compose the shared design system.

- **Atoms** are feature-specific primitives.
- **Molecules** combine application atoms and design-system elements into focused controls.
- **Organisms** compose application molecules into complete interface sections.
- **Templates** compose organisms into reusable page-level layouts.

## Component boundaries

- Every component has its own directory directly under its Atomic Design layer.
- A component directory contains exactly one `.component.tsx` implementation.
- A component must never be nested inside another component's directory. Components composed by a parent are siblings in the appropriate layer, not subcomponents stored under that parent.
- Styles, types, hooks, stories and utilities that belong to a component stay in that component's directory.
- `pages` contains route-level page components and page orchestration. Feature UI components must live in `Atoms`, `Molecules` or `Organisms`, even when used by only one page.
- Route guards and other routing infrastructure remain under `routes`; they are not Atomic Design UI components.

Keep domain behavior in application components and helpers. Import presentation primitives from `@/DesignSystem`; never import application components into the design system.

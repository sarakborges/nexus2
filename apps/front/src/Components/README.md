# Application Components

Application components follow Atomic Design and compose the shared design system.

- **Atoms** are the smallest independently useful UI primitives. They do not compose other application components; examples include avatars, flags, identity markers and small feedback or toolbar elements.
- **Molecules** combine atoms into focused controls or repeatable content units, such as identity links, option rows, list entries and action groups.
- **Organisms** compose molecules into complete interface sections with a clear feature responsibility, such as directories, editors, menus and settings sections.
- **Templates** arrange organisms into reusable page-level layouts without owning route orchestration.

## Component boundaries

- Every component has its own directory directly under its Atomic Design layer. Classify by composition and responsibility, not by file length or naming alone.
- A component directory contains exactly one component implementation file.
- A component must never be nested inside another component's directory. Components composed by a parent are siblings in the appropriate layer, not subcomponents stored under that parent.
- Styles, types, hooks, stories and utilities that belong to a component stay in that component's directory.
- Imports must respect the layer direction: Atoms may use the Design System and domain helpers, Molecules may compose Atoms and other Molecules, Organisms may compose lower layers and other Organisms, and Templates compose the page-level structure. Atoms, Molecules and Organisms must never depend on Templates.
- Internal component imports must target the explicit component/layer path. The aggregate Components barrel is for route/page consumers; component implementations must not use it to import their own layer or another layer.
- Pages contains route-level page components and page orchestration. Feature UI components belong in Components or DesignSystem, even when used by only one page.
- Routes contains route definitions, guards and route-level loading/error boundaries. It must not contain page implementations or feature UI.

## Naming and files

- Source directories use PascalCase. Feature directories use the exported component/page name, including the Page suffix for route pages.
- Component implementations use Name.component.tsx; prop contracts use Name.types.ts; styles use Name.style.scss; hooks use useName.ts or useName.hook.ts consistently with their exported role.
- A component's index.ts is only its public export surface. Do not create a separate component directory for a single-use pass-through that only maps an array or forwards props; keep that behavior in its owning component.
- SCSS follows BEM ownership: nest elements with &__element, modifiers with &--modifier and local states with &:state. Keep responsive overrides inside the owning block where practical.
- Do not use !important. Resolve cascade conflicts through clear ownership, token design, selector scope and import order.

Keep domain behavior in application components and helpers. Import presentation primitives from DesignSystem; never import application components into the design system.

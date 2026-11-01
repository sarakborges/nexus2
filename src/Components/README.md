# Application Components

Application components follow Atomic Design and compose the shared design system.

- **Atoms** are feature-specific primitives, such as the language flag.
- **Molecules** combine application atoms and design-system elements into focused controls.
- **Organisms** compose application molecules into complete interface sections.
- **Templates** may be added when reusable page-level layouts are introduced.

Keep domain behavior in application components and helpers. Import presentation primitives from `@/DesignSystem`; never import application components into the design system.

# Application Components

Application components follow Atomic Design and compose the shared design system.

- **Atoms** are feature-specific primitives. Add this layer when the application needs a primitive that should not belong to the shared design system.
- **Molecules** combine design-system atoms and molecules into focused application controls.
- **Organisms** compose application molecules into complete interface sections.
- **Templates** may be added when reusable page-level layouts are introduced.

Keep domain behavior in application components and helpers. Import presentation primitives from `@/DesignSystem`; never import application components into the design system.

# Design System

The design system follows Atomic Design and contains presentation-focused, reusable UI building blocks.

- **Atoms** are indivisible primitives such as buttons, text, labels, inputs and portraits.
- **Molecules** combine atoms into small reusable controls, such as form fields and decorated buttons.
- **Organisms** compose larger interface regions, such as modal containers.

Components in this directory must not depend on application stores, feature flows or route-specific state. Application components may compose these exports, but the design system must remain independent of them.

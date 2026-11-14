# Design System

The design system follows Atomic Design and contains presentation-focused, reusable UI building blocks.

- **Atoms** are primitives such as buttons, text, labels, inputs, selects and portraits.
- **Molecules** combine atoms into focused reusable controls, such as form fields and select fields.
- **Organisms** compose interface-level elements such as dialogs and notifications.

The design system must not depend on application stores, feature flows or route-specific state. Application components may compose these exports, but the design system remains independent of application features.

The shared `Button` atom exposes a `variation` prop: `primary` (default), `secondary`, `cancel` and `transparent`. It represents a presentation primitive: request and mutation state must be passed explicitly through its standard button props, not read from a global query or application store. Use it instead of creating feature-specific button primitives.

Use `Input` and `Select` for native controls, and compose them through `FormField` and `SelectField` when a visible label is required. Feature-specific editors may keep specialized text areas or controls when their behavior or appearance is intrinsic to the editor.

The `Modal` is a controlled native `dialog` and uses the browser's modal focus and keyboard behavior. `Toast` notifications dismiss themselves after 5,000 ms by default; consumers may override the duration or provide `0` to disable auto-dismissal.

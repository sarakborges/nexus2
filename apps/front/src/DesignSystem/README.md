# Design System

The design system follows Atomic Design and contains presentation-focused, reusable UI building blocks.

- **Atoms** are primitives such as buttons, text, labels, inputs, selects, checkboxes and portraits.
- **Molecules** combine atoms into focused reusable controls, such as form fields and select fields.
- **Organisms** compose interface-level elements such as dialogs and notifications.

The design system must not depend on application stores, feature flows or route-specific state. Application components may compose these exports, but the design system remains independent of application features.

The shared `Button` atom exposes a `variation` prop: `primary` (default), `secondary`, `cancel` and `transparent`. It represents a presentation primitive: request and mutation state must be passed explicitly through its standard button props, not read from a global query or application store. Use it instead of creating feature-specific button primitives.

Use `Input`, `Select` and `Checkbox` for standard form controls, and compose labeled inputs/selects through `FormField` and `SelectField`. Feature-specific editors may keep specialized text areas or controls when their behavior or appearance is intrinsic to the editor.

The `Modal` is a controlled native `dialog` and uses the browser's modal focus and keyboard behavior. `Toast` notifications dismiss themselves after 5,000 ms by default; consumers may override the duration or provide `0` to disable auto-dismissal.

## Visual consistency

- Standard controls use `--nexus-control-height` (40px) for buttons, inputs and selects. Do not introduce component-specific heights for these controls.
- Layout spacing uses the shared `--nexus-space-1` through `--nexus-space-8` scale. Prefer these tokens for gaps, padding and margins instead of new arbitrary spacing values.
- `FormField` and `SelectField` align to the bottom of their parent row so the control itself lines up with neighboring buttons and controls.
- The interface has no transitions or keyframe animations. Hover and active states may change color or background, but must not move, scale or resize elements.

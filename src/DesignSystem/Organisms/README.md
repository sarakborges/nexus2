# Design System organisms

Organisms are complete interface-level building blocks that compose presentation primitives and manage a focused interaction.

- `Modal` wraps the native HTML dialog element, uses a controlled `open` state, and notifies its owner through `onClose`.
- `Toast` presents a live status message and dismisses after 5,000 ms by default. Set `duration={0}` to disable automatic dismissal.

Organisms must remain independent of application stores, routing and feature-specific state.

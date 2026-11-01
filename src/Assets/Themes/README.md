# Theme architecture

- `main.theme.css` is the source of truth for the brand palette and semantic status colors.
- `light.theme.css` and `dark.theme.css` override only appearance-dependent tokens such as neutral colors, text, surfaces and borders.
- Primary, secondary, success, warning and error colors are intentionally not redefined in the appearance files.
- The active appearance is applied to `:root[data-theme='light']` or `:root[data-theme='dark']` by `useThemePreference`.
- Both language and appearance preferences default to `system`; an explicit user choice is persisted and takes precedence.

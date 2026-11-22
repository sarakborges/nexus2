# Theme architecture

- main.theme.css is the sole source of truth for brand colors, semantic status colors and their stable aliases.
- light.theme.css and dark.theme.css own only appearance-dependent values: neutral/text colors, surfaces, borders, color scheme and appearance-specific shadows.
- nexus.theme.css owns the Nexus visual treatment: shape, control, icon and accent-effect tokens plus component-level skin rules. It does not define palette colors.
- The active appearance is applied to the light or dark data-theme selector by useThemePreference.
- Language and appearance preferences default to system; explicit user choices are persisted and take precedence.

Palette values must never be copied into appearance or brand-skin files. Add a semantic token to main.theme.css once, then consume it everywhere else.

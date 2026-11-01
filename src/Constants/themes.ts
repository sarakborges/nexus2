export const SUPPORTED_THEMES = ['light', 'dark'] as const

export type Theme = (typeof SUPPORTED_THEMES)[number]
export type ThemePreference = Theme | 'system'

export const isTheme = (value: unknown): value is Theme =>
  SUPPORTED_THEMES.some((theme) => theme === value)

export const isThemePreference = (
  value: unknown
): value is ThemePreference => value === 'system' || isTheme(value)

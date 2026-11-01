import type { TranslationKey } from '@/Types/Translation.type'

export const SUPPORTED_THEMES = ['light', 'dark'] as const

export type Theme = (typeof SUPPORTED_THEMES)[number]
export type ThemePreference = Theme | 'system'

export const SUPPORTED_THEME_PREFERENCES = [
  'system',
  ...SUPPORTED_THEMES
] as const

export const THEME_PREFERENCE_NAME_KEYS = {
  system: 'THEME_SYSTEM',
  light: 'THEME_LIGHT',
  dark: 'THEME_DARK'
} as const satisfies Record<ThemePreference, TranslationKey>

export const isTheme = (value: unknown): value is Theme =>
  SUPPORTED_THEMES.some((theme) => theme === value)

export const isThemePreference = (
  value: unknown
): value is ThemePreference => value === 'system' || isTheme(value)

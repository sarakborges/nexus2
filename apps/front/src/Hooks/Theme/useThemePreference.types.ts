import type { Theme, ThemePreference } from '@/Constants/themes'

export type UseThemePreferenceResult = {
  theme: Theme
  themePreference: ThemePreference
  setTheme: (theme: ThemePreference) => void
  isUpdating: boolean
}

import {
  SUPPORTED_THEME_PREFERENCES,
  THEME_PREFERENCE_NAME_KEYS
} from '@/Constants/themes'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'

export function ThemeSelector() {
  const { t } = useTranslations()
  const { themePreference, setTheme, isUpdating } = useThemePreference()

  return (
    <PreferenceSelector title={t('APPEARANCE_TITLE')}>
      {SUPPORTED_THEME_PREFERENCES.map(preference => (
        <PreferenceOption
          key={preference}
          label={t(THEME_PREFERENCE_NAME_KEYS[preference])}
          isSelected={themePreference === preference}
          onSelect={() => setTheme(preference)}
          disabled={isUpdating}
        />
      ))}
    </PreferenceSelector>
  )
}

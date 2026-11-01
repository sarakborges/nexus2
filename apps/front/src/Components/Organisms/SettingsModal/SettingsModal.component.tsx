import { useQuery } from '@tanstack/react-query'
import { LanguageSelector } from '@/Components/Organisms/LanguageSelector'
import { RequestState } from '@/Components/Molecules/RequestState'
import { Button, Modal } from '@/DesignSystem'
import { SUPPORTED_THEME_PREFERENCES, THEME_PREFERENCE_NAME_KEYS } from '@/Constants/themes'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import { getUserPreferences } from '@/Services/Settings'
import { queryKeys } from '@/Services/Query/queryKeys'

import './SettingsModal.style.scss'

type SettingsModalProps = {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t } = useTranslations()
  const { themePreference, setTheme, isUpdating } = useThemePreference()
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const updateError = useSettingsStore(state => state.updateError)
  const preferencesQuery = useQuery({
    queryKey: queryKeys.auth.preferences(userId ?? ''),
    queryFn: getUserPreferences,
    enabled: open && Boolean(userId)
  })

  return (
    <Modal open={open} onClose={onClose} title={t('SETTINGS_TITLE')} className="settings-modal">
      <p className="settings-modal__description">{t('SETTINGS_DESCRIPTION')}</p>
      {updateError && <RequestState isError />}
      <RequestState
        isLoading={Boolean(userId && preferencesQuery.isLoading)}
        isError={Boolean(userId && preferencesQuery.isError)}
        onRetry={() => void preferencesQuery.refetch()}
      >
        <section className="settings-modal__section" aria-labelledby="settings-language-title">
          <LanguageSelector />
        </section>
        <section className="settings-modal__section" aria-labelledby="settings-appearance-title">
          <div>
            <h3 className="settings-modal__section-title" id="settings-appearance-title">{t('APPEARANCE_TITLE')}</h3>
            <p className="settings-modal__description">{t('APPEARANCE_DESCRIPTION')}</p>
          </div>
          <div className="settings-modal__options" role="group" aria-label={t('APPEARANCE_TITLE')}>
            {SUPPORTED_THEME_PREFERENCES.map(preference => (
              <Button
                key={preference}
                type="button"
                variation={themePreference === preference ? 'primary' : 'secondary'}
                aria-pressed={themePreference === preference}
                onClick={() => setTheme(preference)}
                disabled={isUpdating}
              >
                {t(THEME_PREFERENCE_NAME_KEYS[preference])}
              </Button>
            ))}
          </div>
        </section>
      </RequestState>
      <div className="settings-modal__actions">
        <Button type="button" variation="secondary" onClick={onClose}>{t('SETTINGS_CLOSE')}</Button>
      </div>
    </Modal>
  )
}

import { LanguageSelector } from '@/Components/Organisms/LanguageSelector'
import { Button, Modal } from '@/DesignSystem'
import { SUPPORTED_THEME_PREFERENCES, THEME_PREFERENCE_NAME_KEYS } from '@/Constants/themes'
import { useTranslations } from '@/Hooks/Language'
import { useThemePreference } from '@/Hooks/Theme'

import './SettingsModal.style.scss'

type SettingsModalProps = {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t } = useTranslations()
  const { themePreference, setTheme } = useThemePreference()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('SETTINGS_TITLE')}
      className="settings-modal"
    >
      <p className="settings-modal__description">{t('SETTINGS_DESCRIPTION')}</p>

      <section className="settings-modal__section" aria-labelledby="settings-language-title">
        <LanguageSelector />
      </section>

      <section className="settings-modal__section" aria-labelledby="settings-appearance-title">
        <div>
          <h3 className="settings-modal__section-title" id="settings-appearance-title">
            {t('APPEARANCE_TITLE')}
          </h3>
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
            >
              {t(THEME_PREFERENCE_NAME_KEYS[preference])}
            </Button>
          ))}
        </div>
      </section>

      <div className="settings-modal__actions">
        <Button type="button" variation="secondary" onClick={onClose}>
          {t('SETTINGS_CLOSE')}
        </Button>
      </div>
    </Modal>
  )
}

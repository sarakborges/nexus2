import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsSaveBarProps } from './ProfileSettingsSaveBar.types'

export function ProfileSettingsSaveBar({
  isDirty,
  isSaving,
  saveError,
  saveSuccess,
  onSave
}: ProfileSettingsSaveBarProps) {
  const { t } = useTranslations()

  return (
    <footer className="profile-settings-page__footer">
      <div aria-live="polite">
        {saveSuccess && <span className="profile-settings-page__success">{t('PROFILE_SETTINGS_SAVED')}</span>}
        {saveError && <span className="profile-settings-page__error">{t('PROFILE_SETTINGS_SAVE_ERROR')}</span>}
      </div>
      <button
        className="profile-settings-page__save"
        type="button"
        disabled={!isDirty || isSaving}
        onClick={onSave}
      >
        {isSaving ? t('PROFILE_SETTINGS_SAVING') : t('PROFILE_SETTINGS_SAVE')}
      </button>
    </footer>
  )
}

import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsSaveBarProps } from './ProfileSettingsSaveBar.types'
import './ProfileSettingsSaveBar.style.scss'

export function ProfileSettingsSaveBar({
  isDirty,
  isSaving,
  saveError,
  saveSuccess,
  onSave
}: ProfileSettingsSaveBarProps) {
  const { t } = useTranslations()

  return (
    <footer className="profile-settings-save-bar">
      <div aria-live="polite">
        {saveSuccess && <span className="profile-settings-save-bar__success">{t('PROFILE_SETTINGS_SAVED')}</span>}
        {saveError && <span className="profile-settings-save-bar__error">{t('PROFILE_SETTINGS_SAVE_ERROR')}</span>}
      </div>
      <Button type="button" disabled={!isDirty || isSaving} onClick={onSave}>
        {isSaving ? t('PROFILE_SETTINGS_SAVING') : t('PROFILE_SETTINGS_SAVE')}
      </Button>
    </footer>
  )
}

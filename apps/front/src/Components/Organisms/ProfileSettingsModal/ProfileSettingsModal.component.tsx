import { ProfileSettingsSaveBar } from '@/Components/Molecules/ProfileSettingsSaveBar'
import { ProfileSettingsActivityMatrix } from '@/Components/Organisms/ProfileSettingsActivityMatrix'
import { ProfileSettingsMessageAudience } from '@/Components/Organisms/ProfileSettingsMessageAudience'
import { Button, Modal } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsModalProps } from './ProfileSettingsModal.types'
import { useProfileSettingsModal } from './useProfileSettingsModal'

import './ProfileSettingsModal.style.scss'

export function ProfileSettingsModal({ open, onClose }: ProfileSettingsModalProps) {
  const { t } = useTranslations()
  const {
    hasProfile,
    isLoading,
    settings,
    isSaving,
    isDirty,
    saveError,
    saveSuccess,
    setMessageAudience,
    toggleActivityType,
    save
  } = useProfileSettingsModal()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('PROFILE_SETTINGS_TITLE')}
      closeLabel={t('SETTINGS_CLOSE')}
      className="profile-settings-modal"
    >
      <div className="profile-settings-modal__content">
        <p className="profile-settings-modal__description">
          {t('PROFILE_SETTINGS_DESCRIPTION')}
        </p>

        {isLoading && (
          <p className="profile-settings-modal__loading" role="status">
            {t('PROFILE_SETTINGS_LOADING')}
          </p>
        )}

        {!isLoading && hasProfile && (
          <>
            <ProfileSettingsMessageAudience
              value={settings.messageAudience}
              onChange={setMessageAudience}
            />

            <ProfileSettingsActivityMatrix
              settings={settings}
              onToggle={toggleActivityType}
            />

            <ProfileSettingsSaveBar
              isDirty={isDirty}
              isSaving={isSaving}
              saveError={saveError}
              saveSuccess={saveSuccess}
              onSave={save}
            />
          </>
        )}
      </div>
    </Modal>
  )
}

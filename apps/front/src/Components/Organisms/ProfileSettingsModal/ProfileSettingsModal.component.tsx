import { ActionConfirmationModal } from '@/Components/Molecules/ActionConfirmationModal'
import { Button, Modal } from '@/DesignSystem'
import { ProfileSettingsSaveBar } from '@/Components/Molecules/ProfileSettingsSaveBar'
import { ProfileSettingsActivityMatrix } from '@/Components/Organisms/ProfileSettingsActivityMatrix'
import { ProfileSettingsMessageAudience } from '@/Components/Organisms/ProfileSettingsMessageAudience'
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
    save,
    isDeleteConfirmationOpen,
    isDeletingProfile,
    requestDeleteProfile,
    cancelDeleteProfile,
    confirmDeleteProfile
  } = useProfileSettingsModal(onClose)

  return (
    <>
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

            <section className="profile-settings-modal__danger-zone">
              <div className="profile-settings-modal__danger-copy">
                <h3>{t('PROFILE_DELETE')}</h3>
                <p>{t('PROFILE_DELETE_DESCRIPTION')}</p>
              </div>
              <Button
                variation="cancel"
                type="button"
                disabled={isSaving || isDeletingProfile}
                onClick={requestDeleteProfile}
              >
                {t('PROFILE_DELETE')}
              </Button>
            </section>

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
    <ActionConfirmationModal
      open={isDeleteConfirmationOpen}
      title={t('PROFILE_DELETE_CONFIRM_TITLE')}
      description={t('PROFILE_DELETE_CONFIRM_DESCRIPTION')}
      confirmLabel={t('PROFILE_DELETE_CONFIRM_ACTION')}
      cancelLabel={t('ACTION_CANCEL')}
      closeLabel={t('SETTINGS_CLOSE')}
      isConfirming={isDeletingProfile}
      onConfirm={confirmDeleteProfile}
      onClose={cancelDeleteProfile}
    />
    </>
  )
}

import { Modal } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { ProfileSettingsPage } from './ProfileSettingsPage.component'
import type { ProfileSettingsModalProps } from './ProfileSettingsModal.types'

export function ProfileSettingsModal({
  open,
  profileUrl,
  onClose
}: ProfileSettingsModalProps) {
  const { t } = useTranslations()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('PROFILE_SETTINGS_TITLE')}
      closeLabel={t('SETTINGS_CLOSE')}
      className="profile-settings-modal"
    >
      <ProfileSettingsPage profileUrl={profileUrl} presentation="modal" />
    </Modal>
  )
}

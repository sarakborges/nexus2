import { Modal } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileSettingsModalProps } from './ProfileSettingsModal.types'
import './ProfileSettingsModal.style.scss'

export function ProfileSettingsModal({
  open,
  onClose,
  children
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
      {children}
    </Modal>
  )
}

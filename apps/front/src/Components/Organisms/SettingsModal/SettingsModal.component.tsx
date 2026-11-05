import type { SettingsModalProps } from './SettingsModal.types'
import { useSettingsModal } from './useSettingsModal.hook'

import { RequestState } from '@/Components/Molecules/RequestState'
import { LanguageSelector } from '@/Components/Organisms/LanguageSelector'
import { ThemeSelector } from '@/Components/Organisms/ThemeSelector'
import { Modal } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

import './SettingsModal.style.scss'

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t } = useTranslations()
  const {
    updateError,
    isLoading,
    isFetching,
    isError,
    retry
  } = useSettingsModal({ open })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('SETTINGS_TITLE')}
      closeLabel={t('SETTINGS_CLOSE')}
      className="settings-modal"
    >
      <p className="settings-modal__description">{t('SETTINGS_DESCRIPTION')}</p>
      {updateError && <RequestState isError />}
      <RequestState
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        onRetry={retry}
      >
        <div className="settings-modal__preferences">
          <LanguageSelector />
          <ThemeSelector />
        </div>
      </RequestState>
    </Modal>
  )
}

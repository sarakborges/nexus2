import { useQuery } from '@tanstack/react-query'
import { LanguageSelector } from '@/Components/Organisms/LanguageSelector'
import { ThemeSelector } from '@/Components/Organisms/ThemeSelector'
import { RequestState } from '@/Components/Molecules/RequestState'
import { Button, Modal } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
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
        isFetching={Boolean(userId && preferencesQuery.isFetching)}
        isError={Boolean(userId && preferencesQuery.isError)}
        onRetry={() => void preferencesQuery.refetch()}
      >
        <div className="settings-modal__preferences">
          <LanguageSelector />
          <ThemeSelector />
        </div>
      </RequestState>
      <div className="settings-modal__actions">
        <Button type="button" variation="secondary" onClick={onClose}>{t('SETTINGS_CLOSE')}</Button>
      </div>
    </Modal>
  )
}

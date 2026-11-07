import type { SettingsModalProps } from './SettingsModal.types'

export type UseSettingsModalOptions = Pick<SettingsModalProps, 'open'>

export type UseSettingsModalController = {
  updateError: boolean
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  retry: () => void
}

import { useQuery } from '@tanstack/react-query'

import type {
  UseSettingsModalController,
  UseSettingsModalOptions
} from './useSettingsModal.types'

import { queryKeys } from '@/Services/Query/queryKeys'
import { getUserPreferences } from '@/Services/Settings'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'

export function useSettingsModal({
  open
}: UseSettingsModalOptions): UseSettingsModalController {
  const userId = useAuthStore((state) => state.session?.user.id ?? null)
  const updateError = useSettingsStore((state) => state.updateError)
  const preferencesQuery = useQuery({
    queryKey: queryKeys.auth.preferences(userId ?? ''),
    queryFn: getUserPreferences,
    enabled: open && Boolean(userId)
  })

  return {
    updateError,
    isLoading: Boolean(userId && preferencesQuery.isLoading),
    isFetching: Boolean(userId && preferencesQuery.isFetching),
    isError: Boolean(userId && preferencesQuery.isError),
    retry: () => void preferencesQuery.refetch()
  }
}

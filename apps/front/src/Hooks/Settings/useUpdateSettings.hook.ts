import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserPreferences } from '@nexus/common'
import { queryKeys } from '@/Services/Query/queryKeys'
import { saveUserPreferences } from '@/Services/Settings'
import { useAuthStore } from '@/Stores/Auth.store'
import { useSettingsStore } from '@/Stores/Settings.store'
import type { SettingsType } from '@/Types/Settings.type'

type UpdateContext = {
  previousSettings: SettingsType
  previousQuery: UserPreferences | undefined
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const userId = useAuthStore(state => state.session?.user.id ?? null)
  const updateSettings = useSettingsStore(state => state.updateSettings)
  const setSettings = useSettingsStore(state => state.setSettings)
  const setUpdateError = useSettingsStore(state => state.setUpdateError)
  const queryKey = queryKeys.auth.preferences(userId ?? '')

  const mutation = useMutation<UserPreferences, unknown, Partial<UserPreferences>, UpdateContext>({
    mutationFn: patch => userId
      ? saveUserPreferences(patch)
      : Promise.resolve({ ...useSettingsStore.getState().settings, ...patch }),
    onMutate: async patch => {
      const previousSettings = useSettingsStore.getState().settings
      const previousQuery = userId ? queryClient.getQueryData<UserPreferences>(queryKey) : undefined
      if (userId) await queryClient.cancelQueries({ queryKey })
      updateSettings(patch)
      if (userId) queryClient.setQueryData<UserPreferences>(queryKey, { ...previousSettings, ...patch })
      setUpdateError(false)
      return { previousSettings, previousQuery }
    },
    onSuccess: data => {
      setSettings(data)
      if (userId) queryClient.setQueryData(queryKey, data)
    },
    onError: (_error, _patch, context) => {
      if (context) {
        setSettings(context.previousSettings)
        if (userId) {
          if (context.previousQuery) queryClient.setQueryData(queryKey, context.previousQuery)
          else queryClient.removeQueries({ queryKey, exact: true })
        }
      }
      setUpdateError(true)
    },
    onSettled: () => {
      if (userId) void queryClient.invalidateQueries({ queryKey })
    }
  })

  return {
    updateSettings: (patch: Partial<UserPreferences>) => mutation.mutate(patch),
    mutation
  }
}

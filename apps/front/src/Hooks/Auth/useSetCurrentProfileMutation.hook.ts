import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseSetCurrentProfileMutationResult } from './useSetCurrentProfileMutation.types'

export function useSetCurrentProfileMutation(): UseSetCurrentProfileMutationResult {
  const queryClient = useQueryClient()
  const setCurrentProfile = useAuthStore((state) => state.setCurrentProfile)

  return useMutation<void, unknown, string>({
    mutationFn: async (profileId) => {
      const success = await setCurrentProfile(profileId)
      if (!success) throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
    },
    onSuccess: async () => {
      queryClient.setQueryData(
        queryKeys.auth.session,
        useAuthStore.getState().session
      )
      await queryClient.invalidateQueries({ queryKey: ['home'] })
    }
  })
}

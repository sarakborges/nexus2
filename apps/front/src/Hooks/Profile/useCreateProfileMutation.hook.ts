import type {
  CreateProfileInput,
  CreateProfileResult
} from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseCreateProfileMutationResult } from './useCreateProfileMutation.types'

export function useCreateProfileMutation(): UseCreateProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<CreateProfileResult, unknown, CreateProfileInput>({
    mutationFn: async (input) => {
      const result = await createUserProfile(input)
      const currentSession = useAuthStore.getState().session

      if (
        !currentSession ||
        result.user.id !== currentSession.user.id ||
        !result.user.profiles.includes(result.profile.id) ||
        result.user.currentProfile !== result.profile.id
      ) {
        throw new Error('PROFILE_CREATION_SESSION_INCONSISTENT')
      }

      useAuthStore.getState().setSession({
        user: result.user,
        authenticatedAt: currentSession.authenticatedAt
      })

      return result
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(
        queryKeys.profiles.byUrl(result.profile.url),
        result.profile
      )
      queryClient.setQueryData(
        queryKeys.auth.session,
        useAuthStore.getState().session
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] })
      ])
    }
  })
}

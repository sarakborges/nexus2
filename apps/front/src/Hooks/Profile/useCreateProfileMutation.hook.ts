import type {
  AuthSession,
  CreateProfileInput,
  CreateProfileResult
} from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getCurrentAuthSession } from '@/Services/Auth'
import { createUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseCreateProfileMutationResult } from './useCreateProfileMutation.types'

export function useCreateProfileMutation(): UseCreateProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<CreateProfileResult, unknown, CreateProfileInput>({
    mutationFn: async (input) => {
      const currentSession = queryClient.getQueryData<AuthSession | null>(
        queryKeys.auth.session
      )
      const result = await createUserProfile(input)

      if (
        !currentSession ||
        result.user.id !== currentSession.user.id ||
        !result.user.profiles.includes(result.profile.id) ||
        result.user.currentProfile !== result.profile.id
      ) {
        throw new Error('PROFILE_CREATION_SESSION_INCONSISTENT')
      }

      queryClient.setQueryData<AuthSession | null>(queryKeys.auth.session, {
        ...currentSession,
        user: result.user,
        currentProfile: null,
        currentProfileSettings: null,
        activities: [],
        activityCursor: null,
        hasMoreActivities: false
      })

      const refreshedSession = await getCurrentAuthSession()
      if (
        !refreshedSession ||
        refreshedSession.user.id !== result.user.id ||
        refreshedSession.user.currentProfile !== result.profile.id
      ) {
        throw new Error('PROFILE_CREATION_SESSION_INCONSISTENT')
      }

      queryClient.setQueryData(queryKeys.auth.session, refreshedSession)

      return result
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(
        queryKeys.profiles.byUrl(result.profile.url),
        result.profile
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] })
      ])
    }
  })
}

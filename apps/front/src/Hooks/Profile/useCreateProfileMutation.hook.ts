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
      const result = await createUserProfile(input)
      const currentSession = queryClient.getQueryData<AuthSession | null>(
        queryKeys.auth.session
      )

      if (
        !currentSession ||
        result.user.id !== currentSession.user.id ||
        !result.user.profiles.includes(result.profile.id) ||
        result.user.currentProfile !== result.profile.id
      ) {
        throw new Error('PROFILE_CREATION_SESSION_INCONSISTENT')
      }

      const nextSession: AuthSession = {
        ...currentSession,
        user: result.user,
        currentProfile: result.profile,
        currentProfileSettings: null,
        suggestedCommunities: [],
        activities: [],
        activityCursor: null,
        hasMoreActivities: false
      }
      queryClient.setQueryData<AuthSession | null>(
        queryKeys.auth.session,
        () => nextSession
      )

      let refreshedSession: AuthSession | null
      try {
        refreshedSession = await getCurrentAuthSession()
      } catch {
        // The profile write already committed. Keep the complete profile returned
        // by that write and let the active session query retry in the background.
        return result
      }

      if (
        !refreshedSession ||
        refreshedSession.user.id !== result.user.id ||
        refreshedSession.user.currentProfile !== result.profile.id
      ) {
        queryClient.setQueryData(queryKeys.auth.session, null)
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
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] })
      ])
    }
  })
}

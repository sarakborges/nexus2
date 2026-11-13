import type {
  CreateProfileInput,
  CreateProfileResult
} from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getCurrentAuthSession } from '@/Services/Auth'
import { createUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'
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

      // Do not keep the previous profile object visible while /me resolves
      // the profile that the create operation has just made active.
      useProfileStore.getState().clearProfile()
      useAuthStore.getState().setSession({
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

      useAuthStore.getState().setSession(refreshedSession)

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
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] })
      ])
    }
  })
}

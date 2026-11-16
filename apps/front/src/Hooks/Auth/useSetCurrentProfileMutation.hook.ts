import type { AuthSession } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getCurrentAuthSession, setCurrentProfile } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseSetCurrentProfileMutationResult } from './useSetCurrentProfileMutation.types'

export function useSetCurrentProfileMutation(): UseSetCurrentProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, string>({
    mutationFn: async (profileId) => {
      const user = await setCurrentProfile(profileId)
      const currentSession = queryClient.getQueryData<AuthSession | null>(
        queryKeys.auth.session
      )

      if (!currentSession || currentSession.user.id !== user.id) {
        throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
      }

      queryClient.setQueryData<AuthSession | null>(queryKeys.auth.session, {
        ...currentSession,
        user,
        currentProfile: null,
        currentProfileSettings: null,
        activities: [],
        activityCursor: null,
        hasMoreActivities: false
      })

      const refreshedSession = await getCurrentAuthSession()
      if (
        !refreshedSession ||
        refreshedSession.user.id !== user.id ||
        refreshedSession.user.currentProfile !== profileId
      ) {
        throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
      }

      queryClient.setQueryData(queryKeys.auth.session, refreshedSession)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-forum-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] })
      ])
    }
  })
}

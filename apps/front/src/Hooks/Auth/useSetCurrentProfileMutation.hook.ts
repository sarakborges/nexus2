import type { AuthSession, PaginatedResult, Profile } from '@nexus/common'
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

      const cachedProfile = queryClient
        .getQueriesData<PaginatedResult<Profile>>({
          queryKey: ['profiles', 'owned', user.id]
        })
        .flatMap(([, page]) => page?.items ?? [])
        .find(profile => profile.id === profileId) ??
        (currentSession.currentProfile?.id === profileId
          ? currentSession.currentProfile
          : null)

      const nextSession: AuthSession = {
        ...currentSession,
        user,
        currentProfile: cachedProfile,
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

      let refreshedSession: AuthSession | null | undefined
      try {
        refreshedSession = await getCurrentAuthSession()
      } catch {
        refreshedSession = undefined
      }

      if (refreshedSession === undefined) {
        if (!cachedProfile) {
          throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
        }
        return
      }

      if (
        !refreshedSession ||
        refreshedSession.user.id !== user.id ||
        refreshedSession.user.currentProfile !== profileId
      ) {
        queryClient.setQueryData(queryKeys.auth.session, null)
        throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
      }

      queryClient.setQueryData(queryKeys.auth.session, refreshedSession)
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] })
      ])
    }
  })
}

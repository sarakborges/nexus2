import type { AuthSession } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getCurrentAuthSession } from '@/Services/Auth'
import { deleteUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseDeleteProfileMutationResult } from './useDeleteProfileMutation.types'

export function useDeleteProfileMutation(): UseDeleteProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<AuthSession | null, unknown, string>({
    mutationFn: async (profileId) => {
      const previousSession = queryClient.getQueryData<AuthSession | null>(
        queryKeys.auth.session
      )
      await deleteUserProfile(profileId)

      try {
        return await getCurrentAuthSession()
      } catch {
        if (!previousSession) return null

        const activeProfileDeleted = previousSession.user.currentProfile === profileId
        return {
          ...previousSession,
          user: {
            ...previousSession.user,
            profiles: previousSession.user.profiles.filter(id => id !== profileId),
            currentProfile: activeProfileDeleted
              ? null
              : previousSession.user.currentProfile
          },
          currentProfile: activeProfileDeleted ? null : previousSession.currentProfile,
          currentProfileSettings: activeProfileDeleted
            ? null
            : previousSession.currentProfileSettings,
          suggestedCommunities: activeProfileDeleted
            ? []
            : previousSession.suggestedCommunities,
          activities: activeProfileDeleted ? [] : previousSession.activities,
          activityCursor: activeProfileDeleted ? null : previousSession.activityCursor,
          hasMoreActivities: activeProfileDeleted ? false : previousSession.hasMoreActivities
        }
      }
    },
    onSuccess: async (session) => {
      queryClient.setQueryData<AuthSession | null>(
        queryKeys.auth.session,
        session
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.session }),
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['community-relationships'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] }),
        queryClient.invalidateQueries({ queryKey: ['communities-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-directory-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-edit-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-composer-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-edit-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-forum-topic-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-members-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-messages-page'] })
      ])
    }
  })
}

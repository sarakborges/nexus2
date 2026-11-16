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
      await deleteUserProfile(profileId)
      return getCurrentAuthSession()
    },
    onSuccess: async (session) => {
      queryClient.setQueryData<AuthSession | null>(
        queryKeys.auth.session,
        session
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
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

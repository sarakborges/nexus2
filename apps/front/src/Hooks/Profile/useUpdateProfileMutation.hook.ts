import type { Profile } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UpdateProfileMutationVariables,
  UseUpdateProfileMutationResult
} from './useUpdateProfileMutation.types'

export function useUpdateProfileMutation(): UseUpdateProfileMutationResult {
  const queryClient = useQueryClient()

  return useMutation<Profile, unknown, UpdateProfileMutationVariables>({
    mutationFn: ({ profileId, input }) => updateUserProfile(profileId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(updated.url), updated)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['communities-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-directory-page'] }),
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

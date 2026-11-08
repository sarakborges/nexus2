import type { Community } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCommunity } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  CreateCommunityMutationVariables,
  UseCreateCommunityMutationResult
} from './useCreateCommunityMutation.types'

export function useCreateCommunityMutation(): UseCreateCommunityMutationResult {
  const queryClient = useQueryClient()

  return useMutation<Community, unknown, CreateCommunityMutationVariables>({
    mutationFn: ({ input, ownerProfileId }) =>
      createCommunity(input, ownerProfileId),
    onSuccess: async (community, variables) => {
      queryClient.setQueryData(
        queryKeys.communities.byUrl(community.url),
        community
      )

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities', 'list'] }),
        queryClient.invalidateQueries({
          queryKey: ['communities', 'by-profile', variables.ownerProfileId]
        }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-page'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-directory-page'] })
      ])
    }
  })
}

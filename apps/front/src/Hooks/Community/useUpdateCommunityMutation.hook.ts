import type { Community } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateCommunity } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UpdateCommunityMutationVariables,
  UseUpdateCommunityMutationResult
} from './useUpdateCommunityMutation.types'

export function useUpdateCommunityMutation(): UseUpdateCommunityMutationResult {
  const queryClient = useQueryClient()

  return useMutation<Community, unknown, UpdateCommunityMutationVariables>({
    mutationFn: ({ communityId, input }) =>
      updateCommunity(communityId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        queryKeys.communities.byUrl(updated.url),
        updated
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities'] }),
        queryClient.invalidateQueries({ queryKey: ['home'] }),
        queryClient.invalidateQueries({ queryKey: ['profile-page'] }),
        queryClient.invalidateQueries({ queryKey: ['community-page'] })
      ])
    }
  })
}

import type { Community, CreateCommunityInput } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateCommunity } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UpdateCommunityMutationVariables } from './useUpdateCommunityMutation.types'

export function useUpdateCommunityMutation() {
  const queryClient = useQueryClient()

  return useMutation<Community, unknown, UpdateCommunityMutationVariables>({
    mutationFn: ({ communityId, input }) =>
      updateCommunity(communityId, input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        queryKeys.communities.byUrl(updated.url),
        updated
      )
      await queryClient.invalidateQueries({ queryKey: ['communities'] })
    }
  })
}

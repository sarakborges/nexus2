import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteCommunityForumTopic } from '@/Services/CommunityForum'
import { invalidateCommunityForumQueries } from './communityForumQuery.utils'
import type {
  DeleteCommunityForumTopicMutationVariables,
  UseDeleteCommunityForumTopicMutationResult
} from './useDeleteCommunityForumTopicMutation.types'

export function useDeleteCommunityForumTopicMutation(): UseDeleteCommunityForumTopicMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, DeleteCommunityForumTopicMutationVariables>({
    mutationFn: ({ communityId, topicId, profileId }) => deleteCommunityForumTopic(communityId, topicId, profileId),
    onSuccess: async (_result, variables) => {
      await invalidateCommunityForumQueries(queryClient, variables.communityId)
    }
  })
}

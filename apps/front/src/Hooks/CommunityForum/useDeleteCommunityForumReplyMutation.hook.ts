import { useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteCommunityForumReply } from '@/Services/CommunityForum'
import { invalidateCommunityForumQueries } from './communityForumQuery.utils'
import type {
  DeleteCommunityForumReplyMutationVariables,
  UseDeleteCommunityForumReplyMutationResult
} from './useDeleteCommunityForumReplyMutation.types'

export function useDeleteCommunityForumReplyMutation(): UseDeleteCommunityForumReplyMutationResult {
  const queryClient = useQueryClient()

  return useMutation<void, unknown, DeleteCommunityForumReplyMutationVariables>({
    mutationFn: ({ communityId, replyId, profileId }) => deleteCommunityForumReply(communityId, replyId, profileId),
    onSuccess: async (_result, variables) => {
      await invalidateCommunityForumQueries(queryClient, variables.communityId)
    }
  })
}

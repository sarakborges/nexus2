import type { CommunityForumReply } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCommunityForumReply } from '@/Services/CommunityForum'
import { invalidateCommunityForumQueries } from './communityForumQuery.utils'
import type {
  CreateCommunityForumReplyMutationVariables,
  UseCreateCommunityForumReplyMutationResult
} from './useCreateCommunityForumReplyMutation.types'

export function useCreateCommunityForumReplyMutation(): UseCreateCommunityForumReplyMutationResult {
  const queryClient = useQueryClient()

  return useMutation<CommunityForumReply, unknown, CreateCommunityForumReplyMutationVariables>({
    mutationFn: ({ communityId, topicId, profileId, content }) => createCommunityForumReply(communityId, topicId, profileId, content),
    onSuccess: async (_result, variables) => {
      await invalidateCommunityForumQueries(queryClient, variables.communityId)
    }
  })
}

import type { CommunityForumTopic } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCommunityForumTopic } from '@/Services/CommunityForum'
import { invalidateCommunityForumQueries } from './communityForumQuery.utils'
import type {
  CreateCommunityForumTopicMutationVariables,
  UseCreateCommunityForumTopicMutationResult
} from './useCreateCommunityForumTopicMutation.types'

export function useCreateCommunityForumTopicMutation(): UseCreateCommunityForumTopicMutationResult {
  const queryClient = useQueryClient()

  return useMutation<CommunityForumTopic, unknown, CreateCommunityForumTopicMutationVariables>({
    mutationFn: ({ communityId, profileId, title, content }) => createCommunityForumTopic(communityId, profileId, title, content),
    onSuccess: async (_result, variables) => {
      await invalidateCommunityForumQueries(queryClient, variables.communityId)
    }
  })
}

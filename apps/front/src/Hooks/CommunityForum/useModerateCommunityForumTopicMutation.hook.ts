import type { CommunityForumTopic } from '@nexus/common'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { moderateCommunityForumTopic } from '@/Services/CommunityForum'
import { invalidateCommunityForumQueries } from './communityForumQuery.utils'
import type {
  CommunityForumTopicModerationChanges,
  ModerateCommunityForumTopicMutationResult
} from './useModerateCommunityForumTopicMutation.types'

export function useModerateCommunityForumTopicMutation(): ModerateCommunityForumTopicMutationResult {
  const queryClient = useQueryClient()

  return useMutation<CommunityForumTopic, unknown, CommunityForumTopicModerationChanges>({
    mutationFn: ({ communityId, topicId, profileId, changes }) => moderateCommunityForumTopic(communityId, topicId, profileId, changes),
    onSuccess: async (_result, variables) => {
      await invalidateCommunityForumQueries(queryClient, variables.communityId)
    }
  })
}

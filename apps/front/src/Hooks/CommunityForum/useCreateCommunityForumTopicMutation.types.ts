import type { CommunityForumTopic } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type CreateCommunityForumTopicMutationVariables = {
  communityId: string
  profileId: string
  title: string
  content: string
}

export type CreateCommunityForumTopicMutationResult = UseMutationResult<
  CommunityForumTopic,
  unknown,
  CreateCommunityForumTopicMutationVariables
>

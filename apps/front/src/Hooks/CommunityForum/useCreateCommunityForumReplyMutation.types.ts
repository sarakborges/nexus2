import type { CommunityForumReply } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type CreateCommunityForumReplyMutationVariables = {
  communityId: string
  topicId: string
  profileId: string
  content: string
}

export type CreateCommunityForumReplyMutationResult = UseMutationResult<
  CommunityForumReply,
  unknown,
  CreateCommunityForumReplyMutationVariables
>

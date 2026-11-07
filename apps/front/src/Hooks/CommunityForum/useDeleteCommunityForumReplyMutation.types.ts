import type { UseMutationResult } from '@tanstack/react-query'

export type DeleteCommunityForumReplyMutationVariables = {
  communityId: string
  replyId: string
  profileId: string
}

export type UseDeleteCommunityForumReplyMutationResult = UseMutationResult<
  void,
  unknown,
  DeleteCommunityForumReplyMutationVariables
>

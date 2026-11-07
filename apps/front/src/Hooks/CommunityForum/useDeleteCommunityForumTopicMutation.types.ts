import type { UseMutationResult } from '@tanstack/react-query'

export type DeleteCommunityForumTopicMutationVariables = {
  communityId: string
  topicId: string
  profileId: string
}

export type DeleteCommunityForumTopicMutationResult = UseMutationResult<
  void,
  unknown,
  DeleteCommunityForumTopicMutationVariables
>

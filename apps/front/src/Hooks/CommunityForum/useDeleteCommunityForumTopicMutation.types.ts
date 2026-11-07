import type { UseMutationResult } from '@tanstack/react-query'

export type DeleteCommunityForumTopicMutationVariables = {
  communityId: string
  topicId: string
  profileId: string
}

export type UseDeleteCommunityForumTopicMutationResult = UseMutationResult<
  void,
  unknown,
  DeleteCommunityForumTopicMutationVariables
>

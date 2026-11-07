import type { CommunityForumTopic } from '@nexus/common'
import type { UseMutationResult } from '@tanstack/react-query'

export type CommunityForumTopicModerationChanges = {
  isPinned?: boolean
  isLocked?: boolean
}

export type ModerateCommunityForumTopicMutationVariables = {
  communityId: string
  topicId: string
  profileId: string
  changes: CommunityForumTopicModerationChanges
}

export type UseModerateCommunityForumTopicMutationResult = UseMutationResult<
  CommunityForumTopic,
  unknown,
  ModerateCommunityForumTopicMutationVariables
>

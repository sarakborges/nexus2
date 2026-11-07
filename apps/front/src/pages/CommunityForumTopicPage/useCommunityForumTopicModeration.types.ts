import type { Community, CommunityForumTopic } from '@nexus/common'

export type UseCommunityForumTopicModerationOptions = {
  community: Community | null | undefined
  topic: CommunityForumTopic | undefined
  forumProfileId: string | null
  canInteract: boolean
  isStaff: boolean
}

export type UseCommunityForumTopicModerationResult = {
  canDeleteTopic: boolean
  isUpdatingTopic: boolean
  isDeletingTopic: boolean
  isDeletingReply: boolean
  togglePinned: () => void
  toggleLocked: () => void
  deleteTopic: () => void
  deleteReply: (replyId: string) => void
}

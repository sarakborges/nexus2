export type CommunityForumTopicModerationActionsProps = {
  canDeleteTopic: boolean
  isStaff: boolean
  isPinned: boolean
  isLocked: boolean
  isUpdatingTopic: boolean
  isDeletingTopic: boolean
  onTogglePinned: () => void
  onToggleLocked: () => void
  onDeleteTopic: () => void
}

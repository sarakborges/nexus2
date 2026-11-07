import type { Profile } from '@nexus/common'

export type CommunityMemberProfile = Profile & {
  role: string
}

export type ForumTopicModerationChanges = {
  isPinned?: boolean
  isLocked?: boolean
}

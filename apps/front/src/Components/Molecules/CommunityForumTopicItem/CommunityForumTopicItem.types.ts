import type { CommunityForumTopicSummary, Profile } from '@nexus/common'

export type CommunityForumTopicItemProps = {
  topic: CommunityForumTopicSummary
  communityUrl: string
  author: Profile | undefined
}

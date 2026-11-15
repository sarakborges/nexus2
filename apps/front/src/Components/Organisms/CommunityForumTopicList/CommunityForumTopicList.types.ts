import type { CommunityForumTopicSummary, Profile } from '@nexus/common'

export type CommunityForumTopicListProps = {
  communityUrl: string
  topics: CommunityForumTopicSummary[]
  authorsById: ReadonlyMap<string, Profile>
}

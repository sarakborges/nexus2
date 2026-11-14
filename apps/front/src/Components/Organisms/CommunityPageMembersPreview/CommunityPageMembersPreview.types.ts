import type { CommunityPageData, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type CommunityPageMembersPreviewProps = {
  communityUrl: string
  communityPageQuery: UseQueryResult<CommunityPageData>
  canViewMembers: boolean
  members: Profile[]
  memberCount: number | undefined
}

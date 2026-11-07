import type { Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { getCommunityMembers } from '@/Services/CommunityRelationship'

export type CommunityPageMembersPreviewProps = {
  communityUrl: string
  canViewMembers: boolean
  membersQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityMembers>>>
  members: Profile[]
  memberCount: number | undefined
}

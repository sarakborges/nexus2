import type { CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { getCommunityMembers } from '@/Services/CommunityRelationship'
import type { Member, MemberTab } from './CommunityMembersPage.types'

export type CommunityMemberTabOption = {
  id: MemberTab
  label: string
}

export type CommunityMemberDirectoryProps = {
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  tabs: CommunityMemberTabOption[]
  activeTab: MemberTab
  visibleTab: MemberTab
  onSelectTab: (tab: MemberTab) => void
  membersQuery: UseQueryResult<Awaited<ReturnType<typeof getCommunityMembers>>>
  members: Member[]
  totalMembers: number
  page: number
  pageSize: number
  onPageChange: ReturnType<typeof useUrlPagination>['setPage']
  relationships: CommunityRelationship[]
  communityId: string
  actorProfileId: string | null
  actorRole: CommunityRelationship['type'] | null
  isStaff: boolean
}

import type { CommunityMembersPageData, CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { Member, MemberTab } from './CommunityMembersPage.types'

export type CommunityMemberTabOption = {
  id: MemberTab
  label: string
}

export type CommunityMemberDirectoryProps = {
  pageQuery: UseQueryResult<CommunityMembersPageData>
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  tabs: CommunityMemberTabOption[]
  visibleTab: MemberTab
  onSelectTab: (tab: MemberTab) => void
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

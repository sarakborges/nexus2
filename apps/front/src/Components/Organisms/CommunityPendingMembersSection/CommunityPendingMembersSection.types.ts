import type { CommunityMembersPageData, CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { CommunityMember } from '@/Models/CommunityMember.model'

export type CommunityPendingMembersSectionProps = {
  pageQuery: UseQueryResult<CommunityMembersPageData>
  pending: CommunityMember[]
  totalPending: number
  page: number
  pageSize: number
  onPageChange: ReturnType<typeof useUrlPagination>['setPage']
  relationships: CommunityRelationship[]
  communityId: string
  actorProfileId: string | null
  actorRole: CommunityRelationship['type'] | null
  isStaff: boolean
}

import type { CommunityMembersPageData, CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { Member } from './CommunityMembersPage.types'

export type CommunityPendingMembersSectionProps = {
  pageQuery: UseQueryResult<CommunityMembersPageData>
  pending: Member[]
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

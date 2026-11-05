import type { Community, CommunityRelationship } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'

import type { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type {
  getCommunityMembers,
  getPendingCommunityMembers
} from '@/Services/CommunityRelationship'
import type { Member, MemberTab } from './CommunityMembersPage.types'

type PaginationSetter = ReturnType<typeof useUrlPagination>['setPage']
type MembersQueryData = Awaited<ReturnType<typeof getCommunityMembers>>
type PendingQueryData = Awaited<ReturnType<typeof getPendingCommunityMembers>>

export type UseCommunityMembersPageResult = {
  normalized: string
  activeTab: MemberTab
  setActiveTab: Dispatch<SetStateAction<MemberTab>>
  page: number
  pageSize: number
  setPage: PaginationSetter
  pendingPage: number
  pendingPageSize: number
  setPendingPage: PaginationSetter
  communityQuery: UseQueryResult<Community | null>
  community: Community | null | undefined
  typeCompatibility: ReturnType<typeof useProfileTypeCompatibility>
  relationshipsQuery: UseQueryResult<CommunityRelationship[]>
  relationships: CommunityRelationship[]
  actorProfileId: string | null
  currentRole: CommunityRelationship['type'] | null
  isStaff: boolean
  visibleTab: MemberTab
  membersQuery: UseQueryResult<MembersQueryData>
  pendingQuery: UseQueryResult<PendingQueryData>
  members: Member[]
  totalMembers: number
  pending: Member[]
  totalPending: number
}

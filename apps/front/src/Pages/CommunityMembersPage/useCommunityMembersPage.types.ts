import type {
  Community,
  CommunityMembersPageData,
  CommunityRelationship
} from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'
import type { Dispatch, SetStateAction } from 'react'

import type { useUrlPagination } from '@/Hooks/useUrlPagination'
import type { Member, MemberTab } from './CommunityMembersPage.types'

type PaginationSetter = ReturnType<typeof useUrlPagination>['setPage']

export type UseCommunityMembersPageResult = {
  normalized: string
  isAuthInitialized: boolean
  activeTab: MemberTab
  setActiveTab: Dispatch<SetStateAction<MemberTab>>
  page: number
  pageSize: number
  query: string
  sort: ReturnType<typeof useUrlPagination>['sort']
  setQuery: ReturnType<typeof useUrlPagination>['setQuery']
  setSort: ReturnType<typeof useUrlPagination>['setSort']
  setPage: PaginationSetter
  pendingPage: number
  pendingPageSize: number
  setPendingPage: PaginationSetter
  communityMembersPageQuery: UseQueryResult<CommunityMembersPageData>
  community: Community | null | undefined
  viewerRelationship: CommunityRelationship | null
  typeCompatibility: {
    isChecking: boolean
    isCompatible: boolean
    canInteract: boolean
  }
  relationships: CommunityRelationship[]
  actorProfileId: string | null
  currentRole: CommunityRelationship['type'] | null
  isStaff: boolean
  visibleTab: MemberTab
  members: Member[]
  totalMembers: number
  pending: Member[]
  totalPending: number
}

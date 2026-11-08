
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityMembersPage } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { MemberTab } from './CommunityMembersPage.types'
import type { UseCommunityMembersPageResult } from './useCommunityMembersPage.types'

export function useCommunityMembersPage(): UseCommunityMembersPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const isAuthInitialized = useAuthStore((state) => state.isInitialized)
  const viewerUserId = session?.user.id ?? null
  const profileIds = session?.user.profiles ?? []
  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const { page, pageSize, setPage } = useUrlPagination('page')
  const {
    page: pendingPage,
    pageSize: pendingPageSize,
    setPage: setPendingPage
  } = useUrlPagination('pendingPage')

  const communityMembersPageQuery = useQuery({
    queryKey: queryKeys.communityMembersPage(
      normalized,
      activeTab,
      page,
      pendingPage,
      viewerUserId,
      profileIds
    ),
    queryFn: () =>
      getCommunityMembersPage(normalized, {
        tab: activeTab,
        page,
        pendingPage
      }),
    enabled: Boolean(normalized && isAuthInitialized),
    staleTime: 30 * 1000
  })
  const pageData = communityMembersPageQuery.data
  const community = pageData?.community
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const visibleTab = pageData?.visibleTab ?? 'all'
  const isStaff = pageData?.isStaff ?? false
  const relationships = pageData?.relationships ?? []
  const actorProfileId = pageData?.actorProfileId ?? null
  const currentRole = pageData?.actorRole ?? null
  const members = pageData?.members.items ?? []
  const totalMembers = pageData?.members.totalItems ?? 0
  const pending = pageData?.pending.items ?? []
  const totalPending = pageData?.pending.totalItems ?? 0

  useEffect(() => {
    if (pageData?.members && pageData.members.page !== page) {
      setPage(pageData.members.page)
    }
  }, [pageData?.members, page, setPage])
  useEffect(() => {
    if (pageData?.pending && pageData.pending.page !== pendingPage) {
      setPendingPage(pageData.pending.page)
    }
  }, [pageData?.pending, pendingPage, setPendingPage])

  return {
    normalized,
    isAuthInitialized,
    activeTab,
    setActiveTab,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityMembersPageQuery,
    community,
    typeCompatibility,
    relationships,
    actorProfileId,
    currentRole,
    isStaff,
    visibleTab,
    members,
    totalMembers,
    pending,
    totalPending
  }
}

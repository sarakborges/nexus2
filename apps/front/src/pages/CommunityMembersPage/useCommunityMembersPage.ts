import { useQuery } from '@tanstack/react-query'

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'

import type { Member, MemberTab } from './CommunityMembersPage.types'
import type { UseCommunityMembersPageResult } from './useCommunityMembersPage.types'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useCommunityAccess } from '@/Hooks/Community'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityByUrl } from '@/Services/Community'
import {
  getCommunityMembers,
  getPendingCommunityMembers
} from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

export function useCommunityMembersPage(): UseCommunityMembersPageResult {
  const { url } = useParams<{ url: string }>()
  const normalized = normalizeEntityUrl(url)
  const session = useAuthStore((state) => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const profileIds = session?.user.profiles ?? []
  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const { page, pageSize, setPage } = useUrlPagination('page')
  const {
    page: pendingPage,
    pageSize: pendingPageSize,
    setPage: setPendingPage
  } = useUrlPagination('pendingPage')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized, session?.user.id ?? null),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const {
    relationshipsQuery,
    relationships,
    managementProfileId: actorProfileId,
    currentRole,
    isStaff
  } = useCommunityAccess({
    communityId: community?.id ?? null,
    viewerUserId: session?.user.id ?? null,
    profileIds
  })
  const visibleTab: MemberTab = isStaff ? activeTab : 'all'
  const membersQuery = useQuery({
    queryKey: queryKeys.communityMembers(
      community?.id ?? '',
      visibleTab,
      page,
      pageSize,
      actorProfileId ?? currentProfileId ?? undefined,
      session?.user.id ?? null
    ),
    queryFn: () =>
      getCommunityMembers(
        community!.id,
        visibleTab,
        { page, pageSize },
        actorProfileId ?? currentProfileId ?? undefined
      ),
    enabled: Boolean(community?.id && relationshipsQuery.isSuccess)
  })
  const pendingQuery = useQuery({
    queryKey: queryKeys.pendingCommunityMembers(
      community?.id ?? '',
      actorProfileId ?? '',
      pendingPage,
      pendingPageSize,
      session?.user.id ?? null
    ),
    queryFn: () =>
      getPendingCommunityMembers(community!.id, actorProfileId!, {
        page: pendingPage,
        pageSize: pendingPageSize
      }),
    enabled: Boolean(
      community?.id && actorProfileId && isStaff && relationshipsQuery.isSuccess
    )
  })
  const members: Member[] = membersQuery.data?.items ?? []
  const totalMembers = membersQuery.data?.totalItems ?? 0
  const pending: Member[] = pendingQuery.data?.items ?? []
  const totalPending = pendingQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (membersQuery.data && membersQuery.data.page !== page)
      setPage(membersQuery.data.page)
  }, [membersQuery.data, page, setPage])
  useEffect(() => {
    if (pendingQuery.data && pendingQuery.data.page !== pendingPage)
      setPendingPage(pendingQuery.data.page)
  }, [pendingQuery.data, pendingPage, setPendingPage])


  return {
    normalized,
    activeTab,
    setActiveTab,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    relationships,
    actorProfileId,
    currentRole,
    isStaff,
    visibleTab,
    membersQuery,
    pendingQuery,
    members,
    totalMembers,
    pending,
    totalPending
  }
}

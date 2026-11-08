import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityForumPage } from '@/Services/CommunityForum'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { normalizeEntityUrl } from '@/Utils/entityUrl.utils'
import type { UseCommunityForumPageResult } from './useCommunityForumPage.types'

export function useCommunityForumPage(): UseCommunityForumPageResult {
  const { url } = useParams<{ url: string }>()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const viewerUserId = session?.user.id ?? null
  const currentProfileId = session?.user.currentProfile ?? null
  const normalized = normalizeEntityUrl(url)
  const { page, pageSize, setPage } = useUrlPagination()

  const forumPageQuery = useQuery({
    queryKey: queryKeys.communityForumPage(
      normalized,
      page,
      pageSize,
      viewerUserId,
      currentProfileId
    ),
    queryFn: () => getCommunityForumPage(normalized, { page, pageSize }),
    enabled: Boolean(normalized),
    staleTime: 30 * 1000
  })
  const community = forumPageQuery.data?.community
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const topics = forumPageQuery.data?.topics.items ?? []
  const authorsById = useMemo(
    () =>
      new Map(
        (forumPageQuery.data?.authors ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [forumPageQuery.data?.authors]
  )

  const openCreateTopic = () => {
    if (community) {
      navigate(ROUTES.community + '/' + community.url + '/forum/new')
    }
  }

  return {
    normalized,
    session,
    page,
    pageSize,
    setPage,
    forumPageQuery,
    community,
    typeCompatibility,
    canReadForum: forumPageQuery.data?.canReadForum ?? false,
    canPublish: forumPageQuery.data?.canPublish ?? false,
    openCreateTopic,
    topics,
    authorsById
  }
}

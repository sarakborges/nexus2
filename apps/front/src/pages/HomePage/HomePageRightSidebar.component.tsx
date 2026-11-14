import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { Community, ProfileDirectoryPageData } from '@nexus/common'
import { HomePageEntityPreview } from './HomePageEntityPreview.component'
import type { HomePageEntityPreviewItem } from './HomePageEntityPreview.types'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

import './HomePage.style.scss'

const PREVIEW_PAGE_SIZE = 100
const PREVIEW_ITEMS = 4

function getDirectoryItems(
  data: ProfileDirectoryPageData | undefined,
  kind: 'friends' | 'communities'
): HomePageEntityPreviewItem[] {
  if (kind === 'friends' && data?.kind === 'friends') {
    return data.friends.items.slice(0, PREVIEW_ITEMS)
  }
  if (kind === 'communities' && data?.kind === 'communities') {
    return data.communities.items.slice(0, PREVIEW_ITEMS)
  }
  return []
}

function getPublicSuggestions(
  candidates: Community[],
  memberships: ProfileDirectoryPageData | undefined
): Community[] {
  const memberIds = new Set(
    memberships?.kind === 'communities'
      ? memberships.communities.items.map(community => community.id)
      : []
  )

  return candidates
    .filter(community => community.privacy === 'public' && !memberIds.has(community.id))
    .slice(0, PREVIEW_ITEMS)
}

export function HomePageRightSidebar({ currentProfile }: HomePageRightSidebarProps) {
  const { t } = useTranslations()

  const friendsQuery = useQuery({
    queryKey: queryKeys.homeSidebar.friends(currentProfile.id),
    queryFn: () => getProfileDirectoryPage(currentProfile.url, 'friends', {
      page: 1,
      pageSize: PREVIEW_PAGE_SIZE,
      sort: 'activity-desc'
    }),
    enabled: Boolean(currentProfile.id),
    staleTime: 60 * 1000
  })

  const communitiesQuery = useQuery({
    queryKey: queryKeys.homeSidebar.communities(currentProfile.id),
    queryFn: () => getProfileDirectoryPage(currentProfile.url, 'communities', {
      page: 1,
      pageSize: PREVIEW_PAGE_SIZE,
      sort: 'activity-desc'
    }),
    enabled: Boolean(currentProfile.id),
    staleTime: 60 * 1000
  })

  const suggestionsQuery = useQuery({
    queryKey: queryKeys.homeSidebar.suggestions(currentProfile.id),
    queryFn: () => getCommunities({
      page: 1,
      pageSize: PREVIEW_PAGE_SIZE,
      sort: 'activity-desc'
    }),
    enabled: Boolean(currentProfile.id),
    staleTime: 60 * 1000
  })

  const friends = getDirectoryItems(friendsQuery.data, 'friends')
  const communities = getDirectoryItems(communitiesQuery.data, 'communities')
  const suggestions = useMemo(
    () => getPublicSuggestions(
      suggestionsQuery.data?.items ?? [],
      communitiesQuery.data
    ),
    [suggestionsQuery.data?.items, communitiesQuery.data]
  )

  const friendsTotal = friendsQuery.data?.kind === 'friends'
    ? friendsQuery.data.friends.totalItems
    : 0
  const communitiesTotal = communitiesQuery.data?.kind === 'communities'
    ? communitiesQuery.data.communities.totalItems
    : 0

  return (
    <div className="home-page__previews">
      <HomePageEntityPreview
        title={t('PROFILE_FRIENDS_TITLE')}
        items={friends}
        totalItems={friendsTotal}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        isLoading={friendsQuery.isLoading}
        isFetching={friendsQuery.isFetching}
        isError={friendsQuery.isError}
        onRetry={() => void friendsQuery.refetch()}
        viewAllHref={ROUTES.profile + '/' + currentProfile.url + '/friends'}
        viewAllLabel={t('COMMON_VIEW_ALL')}
        getHref={item => ROUTES.profile + '/' + item.url}
        getSecondary={item => '@' + item.url}
      />
      <HomePageEntityPreview
        title={t('PROFILE_COMMUNITIES_TITLE')}
        items={communities}
        totalItems={communitiesTotal}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        onRetry={() => void communitiesQuery.refetch()}
        viewAllHref={ROUTES.profile + '/' + currentProfile.url + '/communities'}
        viewAllLabel={t('COMMON_VIEW_ALL')}
        getHref={item => ROUTES.community + '/' + item.url}
        getSecondary={item => '/community/' + item.url}
      />
      <HomePageEntityPreview
        title={t('HOME_SUGGESTED_COMMUNITIES')}
        items={suggestions}
        emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
        isLoading={suggestionsQuery.isLoading || communitiesQuery.isLoading}
        isFetching={suggestionsQuery.isFetching || communitiesQuery.isFetching}
        isError={suggestionsQuery.isError || communitiesQuery.isError}
        onRetry={() => {
          void suggestionsQuery.refetch()
          void communitiesQuery.refetch()
        }}
        getHref={item => ROUTES.community + '/' + item.url}
        getSecondary={item => '/community/' + item.url}
      />
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import type { ProfileDirectoryPageData } from '@nexus/common'

import type { HomePageEntityPreviewItem } from '@/Components/Organisms/HomePageEntityPreview/HomePageEntityPreview.types'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { getProfileDirectoryPage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseHomePageRightSidebarOptions,
  UseHomePageRightSidebarResult
} from './useHomePageRightSidebar.types'

const PREVIEW_PAGE_SIZE = DEFAULT_PAGE_SIZE
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

export function useHomePageRightSidebar({
  currentProfile,
  suggestedCommunities
}: UseHomePageRightSidebarOptions): UseHomePageRightSidebarResult {
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

  return {
    friends: {
      items: getDirectoryItems(friendsQuery.data, 'friends'),
      totalItems: friendsQuery.data?.kind === 'friends'
        ? friendsQuery.data.friends.totalItems
        : 0,
      isLoading: friendsQuery.isLoading,
      isFetching: friendsQuery.isFetching,
      isError: friendsQuery.isError,
      onRetry: () => void friendsQuery.refetch()
    },
    communities: {
      items: getDirectoryItems(communitiesQuery.data, 'communities'),
      totalItems: communitiesQuery.data?.kind === 'communities'
        ? communitiesQuery.data.communities.totalItems
        : 0,
      isLoading: communitiesQuery.isLoading,
      isFetching: communitiesQuery.isFetching,
      isError: communitiesQuery.isError,
      onRetry: () => void communitiesQuery.refetch()
    },
    suggestedCommunities: suggestedCommunities.map(({ id, name, url, picture }) => ({
      id,
      name,
      url,
      picture
    }))
  }
}

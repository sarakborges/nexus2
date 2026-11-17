import { useQuery } from '@tanstack/react-query'

import { getProfilePage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthSessionState } from '@/Hooks/Auth'
import type { HomePagePreviewItem } from './HomePageRightSidebar.types'
import type {
  UseHomePageRightSidebarOptions,
  UseHomePageRightSidebarResult
} from './useHomePageRightSidebar.types'

const PREVIEW_ITEMS = 16

export function useHomePageRightSidebar({
  currentProfile,
  suggestedCommunities
}: UseHomePageRightSidebarOptions): UseHomePageRightSidebarResult {
  const userId = useAuthSessionState(state => state.session?.user.id ?? null)
  const profilePageQuery = useQuery({
    queryKey: queryKeys.profilePage(currentProfile.url, userId, currentProfile.id),
    queryFn: () => getProfilePage(currentProfile.url),
    enabled: Boolean(userId && currentProfile.id),
    staleTime: 60 * 1000
  })

  const friends = profilePageQuery.data?.friends
  const communities = profilePageQuery.data?.communities

  return {
    friends: {
      items: (friends?.items ?? []).slice(0, PREVIEW_ITEMS),
      totalItems: friends?.totalItems ?? 0,
      isLoading: profilePageQuery.isLoading,
      isFetching: profilePageQuery.isFetching,
      isError: profilePageQuery.isError,
      isEmpty: profilePageQuery.isSuccess && (friends?.totalItems ?? 0) === 0,
      onRetry: () => void profilePageQuery.refetch()
    },
    communities: {
      items: (communities?.items ?? []).slice(0, PREVIEW_ITEMS),
      totalItems: communities?.totalItems ?? 0,
      isLoading: profilePageQuery.isLoading,
      isFetching: profilePageQuery.isFetching,
      isError: profilePageQuery.isError,
      isEmpty: profilePageQuery.isSuccess && (communities?.totalItems ?? 0) === 0,
      onRetry: () => void profilePageQuery.refetch()
    },
    suggestedCommunities: suggestedCommunities
      .slice(0, PREVIEW_ITEMS)
      .map(({ id, name, url, picture }): HomePagePreviewItem => ({
        id,
        name,
        url,
        picture
      }))
  }
}

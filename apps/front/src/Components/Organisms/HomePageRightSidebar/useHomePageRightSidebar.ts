import { useQuery } from '@tanstack/react-query'

import type { HomePageEntityPreviewItem } from '@/Components/Organisms/HomePageEntityPreview/HomePageEntityPreview.types'
import { getProfilePage } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type {
  UseHomePageRightSidebarOptions,
  UseHomePageRightSidebarResult
} from './useHomePageRightSidebar.types'

const PREVIEW_ITEMS = 4

export function useHomePageRightSidebar({
  currentProfile,
  suggestedCommunities
}: UseHomePageRightSidebarOptions): UseHomePageRightSidebarResult {
  const userId = useAuthStore(state => state.session?.user.id ?? null)
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
      onRetry: () => void profilePageQuery.refetch()
    },
    communities: {
      items: (communities?.items ?? []).slice(0, PREVIEW_ITEMS),
      totalItems: communities?.totalItems ?? 0,
      isLoading: profilePageQuery.isLoading,
      isFetching: profilePageQuery.isFetching,
      isError: profilePageQuery.isError,
      onRetry: () => void profilePageQuery.refetch()
    },
    suggestedCommunities: suggestedCommunities.map(({ id, name, url, picture }) => ({
      id,
      name,
      url,
      picture
    }) satisfies HomePageEntityPreviewItem)
  }
}

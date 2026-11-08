import { useQuery } from '@tanstack/react-query'

import { getProfileCommunities } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'
import type {
  UseHomeSocialPreviewsOptions,
  UseHomeSocialPreviewsResult
} from './useHomeSocialPreviews.types'

export function useHomeSocialPreviews({
  currentProfile
}: UseHomeSocialPreviewsOptions): UseHomeSocialPreviewsResult {
  const profileId = currentProfile?.id ?? ''

  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(profileId, 1, 8),
    queryFn: () =>
      getProfileFriends(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(profileId, 1, 8),
    queryFn: () =>
      getProfileCommunities(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })

  return {
    friendsQuery,
    communitiesQuery,
    friends: friendsQuery.data?.items ?? [],
    communities: communitiesQuery.data?.items ?? []
  }
}

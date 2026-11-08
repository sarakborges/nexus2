import { useQuery } from '@tanstack/react-query'

import { getCommunities, getProfileCommunities } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseHomeCommunitySuggestionsOptions,
  UseHomeCommunitySuggestionsResult
} from './useHomeCommunitySuggestions.types'

export function useHomeCommunitySuggestions({
  currentProfile,
  profileIds
}: UseHomeCommunitySuggestionsOptions): UseHomeCommunitySuggestionsResult {
  const allCommunitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(1, 50),
    queryFn: () => getCommunities({ page: 1, pageSize: 50 }),
    enabled: Boolean(currentProfile)
  })
  const ownedCommunityIdsQuery = useQuery({
    queryKey: queryKeys.communities.ownedMemberships(profileIds),
    queryFn: async () => {
      const memberships = await Promise.all(
        profileIds.map((profileId) =>
          getProfileCommunities(profileId, { page: 1, pageSize: 100 })
        )
      )
      return memberships.flatMap((result) =>
        result.items.map((community) => community.id)
      )
    },
    enabled: profileIds.length > 0,
    staleTime: 30 * 1000
  })

  const ownedCommunityIds = new Set(ownedCommunityIdsQuery.data ?? [])
  const suggestions = (allCommunitiesQuery.data?.items ?? [])
    .filter(
      (community) =>
        community.type === currentProfile?.type &&
        !ownedCommunityIds.has(community.id)
    )
    .slice(0, 8)

  return {
    allCommunitiesQuery,
    ownedCommunityIdsQuery,
    suggestions
  }
}

import { useQuery } from '@tanstack/react-query'

import { getRecentActivity } from '@/Services/Activity'
import { getCommunities, getProfileCommunities } from '@/Services/Community'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { getProfileFriends } from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import type { UseHomePageResult } from './useHomePage.types'

export function useHomePage(): UseHomePageResult {
  const session = useAuthStore((state) => state.session)
  const userId = session?.user.id ?? null
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null

  const activityQuery = useQuery({
    queryKey: queryKeys.activity.recent(userId ?? ''),
    queryFn: getRecentActivity,
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true
  })
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const profiles = profilesQuery.data ?? []
  const currentProfile =
    profiles.find((profile) => profile.id === currentProfileId) ??
    profiles[0] ??
    null
  const friendsQuery = useQuery({
    queryKey: queryKeys.relationships.friends(currentProfile?.id ?? '', 1, 8),
    queryFn: () =>
      getProfileFriends(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.byProfile(currentProfile?.id ?? '', 1, 8),
    queryFn: () =>
      getProfileCommunities(currentProfile!.id, { page: 1, pageSize: 8 }),
    enabled: Boolean(currentProfile)
  })
  const allCommunitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(1, 50),
    queryFn: () => getCommunities({ page: 1, pageSize: 50 }),
    enabled: Boolean(currentProfile)
  })
  const ownedCommunityIdsQuery = useQuery({
    queryKey: ['communities', 'owned-memberships', ...[...profileIds].sort()],
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

  const activities = activityQuery.data ?? []
  const friends = friendsQuery.data?.items ?? []
  const communities = communitiesQuery.data?.items ?? []
  const ownedCommunityIds = new Set(ownedCommunityIdsQuery.data ?? [])
  const suggestions = (allCommunitiesQuery.data?.items ?? [])
    .filter(
      (community) =>
        community.type === currentProfile?.type &&
        !ownedCommunityIds.has(community.id)
    )
    .slice(0, 8)
  const formatDate = (timestamp: number) =>
    new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(timestamp)


  return {
    activityQuery,
    profilesQuery,
    friendsQuery,
    communitiesQuery,
    allCommunitiesQuery,
    ownedCommunityIdsQuery,
    currentProfile,
    activities,
    friends,
    communities,
    suggestions,
    formatDate
  }
}

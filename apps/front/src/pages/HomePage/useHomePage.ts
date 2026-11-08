import { useQuery } from '@tanstack/react-query'

import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useHomeActivity } from './useHomeActivity.hook'
import { useHomeCommunitySuggestions } from './useHomeCommunitySuggestions.hook'
import { useHomeSocialPreviews } from './useHomeSocialPreviews.hook'
import type { UseHomePageResult } from './useHomePage.types'

export function useHomePage(): UseHomePageResult {
  const session = useAuthStore((state) => state.session)
  const userId = session?.user.id ?? null
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null

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

  const activity = useHomeActivity(userId)
  const socialPreviews = useHomeSocialPreviews({ currentProfile })
  const communitySuggestions = useHomeCommunitySuggestions({
    currentProfile,
    profileIds
  })

  return {
    profilesQuery,
    currentProfile,
    ...activity,
    ...socialPreviews,
    ...communitySuggestions
  }
}

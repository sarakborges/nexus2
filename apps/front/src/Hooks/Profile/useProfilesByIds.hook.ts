import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'

import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseProfilesByIdsResult } from './useProfilesByIds.types'

export function useProfilesByIds(profileIds: string[]): UseProfilesByIdsResult {
  const normalizedIds = useMemo(
    () => [...new Set(profileIds)],
    [profileIds]
  )
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(normalizedIds),
    queryFn: () => getProfilesByIds(normalizedIds),
    enabled: normalizedIds.length > 0
  })
  const profilesById = useMemo(
    () =>
      new Map(
        (profilesQuery.data ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [profilesQuery.data]
  )

  return { profilesQuery, profilesById }
}

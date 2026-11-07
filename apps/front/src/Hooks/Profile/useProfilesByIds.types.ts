import type { Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseProfilesByIdsResult = {
  profilesQuery: UseQueryResult<Profile[]>
  profilesById: Map<string, Profile>
}

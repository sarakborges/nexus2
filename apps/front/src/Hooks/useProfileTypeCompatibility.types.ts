import type { Profile, ProfileType } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseProfileTypeCompatibilityResult = {
  isCompatible: boolean
  isChecking: boolean
  currentProfileType: ProfileType | null
  currentProfileQuery: UseQueryResult<Profile | null>
}

import type { ProfileType } from '@nexus/common'
import { useQuery } from '@tanstack/react-query'

import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthSessionState } from '@/Hooks/Auth'
import type { UseProfileTypeCompatibilityResult } from './useProfileTypeCompatibility.types'

export function useProfileTypeCompatibility(
  targetType: ProfileType
): UseProfileTypeCompatibilityResult {
  const hasSession = useAuthSessionState((state) => Boolean(state.session))
  const currentProfileId = useAuthSessionState(
    (state) => state.session?.user.currentProfile ?? null
  )
  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.currentType(currentProfileId ?? ''),
    queryFn: async () =>
      (await getProfilesByIds([currentProfileId!]))[0] ?? null,
    enabled: Boolean(currentProfileId)
  })
  const isChecking = Boolean(currentProfileId && currentProfileQuery.isLoading)
  const currentType = currentProfileQuery.data?.type ?? null
  const isCompatible =
    !currentProfileId ||
    (currentProfileQuery.isSuccess && currentType === targetType)
  const canInteract =
    !hasSession || (isCompatible && !isChecking)

  return {
    isCompatible,
    isChecking,
    canInteract,
    currentProfileType: currentType,
    currentProfileQuery
  }
}

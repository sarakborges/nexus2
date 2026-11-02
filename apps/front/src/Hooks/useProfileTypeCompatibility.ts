import { useQuery } from '@tanstack/react-query'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import type { ProfileType } from '@nexus/common'

export function useProfileTypeCompatibility(targetType: ProfileType) {
  const currentProfileId = useAuthStore(state => state.session?.user.currentProfile ?? null)
  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.currentType(currentProfileId ?? ''),
    queryFn: async () => (await getProfilesByIds([currentProfileId!]))[0] ?? null,
    enabled: Boolean(currentProfileId)
  })
  const isChecking = Boolean(currentProfileId && currentProfileQuery.isLoading)
  const currentType = currentProfileQuery.data?.type ?? null
  const isCompatible = !currentProfileId || (currentProfileQuery.isSuccess && currentType === targetType)
  return { isCompatible, isChecking, currentProfileType: currentType, currentProfileQuery }
}

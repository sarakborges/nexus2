import type { Profile } from '@nexus/common'
import { useQuery } from '@tanstack/react-query'

import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type { UseProfileByUrlOptions } from './useProfileByUrl.types'

export function useProfileByUrl({
  url,
  enabled = true
}: UseProfileByUrlOptions) {
  return useQuery({
    queryKey: queryKeys.profiles.byUrl(url),
    queryFn: () => getProfileByUrl(url),
    enabled: Boolean(url) && enabled
  })
}

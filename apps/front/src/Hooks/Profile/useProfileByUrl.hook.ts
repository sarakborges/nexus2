import { useQuery } from '@tanstack/react-query'

import { getProfileByUrl } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseProfileByUrlOptions,
  UseProfileByUrlResult
} from './useProfileByUrl.types'

export function useProfileByUrl({
  url,
  enabled = true
}: UseProfileByUrlOptions): UseProfileByUrlResult {
  return useQuery({
    queryKey: queryKeys.profiles.byUrl(url),
    queryFn: () => getProfileByUrl(url),
    enabled: Boolean(url) && enabled
  })
}

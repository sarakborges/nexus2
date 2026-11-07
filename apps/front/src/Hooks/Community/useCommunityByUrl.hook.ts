import { useQuery } from '@tanstack/react-query'

import { getCommunityByUrl } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import type {
  UseCommunityByUrlOptions,
  UseCommunityByUrlResult
} from './useCommunityByUrl.types'

export function useCommunityByUrl({
  url,
  viewerUserId = null,
  enabled = true
}: UseCommunityByUrlOptions): UseCommunityByUrlResult {
  return useQuery({
    queryKey: queryKeys.communities.byUrl(url, viewerUserId),
    queryFn: () => getCommunityByUrl(url),
    enabled: Boolean(url) && enabled
  })
}

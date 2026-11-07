import type { Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseProfileByUrlOptions = {
  url: string
  enabled?: boolean
}

export type UseProfileByUrlResult = UseQueryResult<Profile | null>

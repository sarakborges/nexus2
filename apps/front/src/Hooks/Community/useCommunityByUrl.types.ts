import type { Community } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseCommunityByUrlOptions = {
  url: string
  viewerUserId?: string | null
  enabled?: boolean
}

export type UseCommunityByUrlResult = UseQueryResult<Community | null>

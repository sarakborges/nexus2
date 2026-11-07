import type { Community, PaginatedResult } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageCommunitiesPreviewProps = {
  profileUrl: string
  communitiesQuery: UseQueryResult<PaginatedResult<Community>>
  communities: Community[]
}

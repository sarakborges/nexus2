import type { HomePageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageSuggestedCommunitiesPreviewProps = {
  homeQuery: UseQueryResult<HomePageData>
}

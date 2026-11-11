import type { HomePageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageCommunitiesPreviewProps = {
  profileUrl: string
  homeQuery: UseQueryResult<HomePageData>
}

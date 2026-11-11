import type { HomePageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageFriendsPreviewProps = {
  profileUrl: string
  homeQuery: UseQueryResult<HomePageData>
}

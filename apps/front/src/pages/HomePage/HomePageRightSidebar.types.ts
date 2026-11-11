import type { HomePageData, Profile } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type HomePageRightSidebarProps = {
  currentProfile: Profile
  homeQuery: UseQueryResult<HomePageData>
}

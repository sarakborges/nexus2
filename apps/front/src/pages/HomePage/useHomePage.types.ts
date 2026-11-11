import type { HomePageData } from '@nexus/common'
import type { UseQueryResult } from '@tanstack/react-query'

export type UseHomePageResult = {
  homeQuery: UseQueryResult<HomePageData>
}

import type { HomePageEntityPreviewItem } from '@/Components/Organisms/HomePageEntityPreview/HomePageEntityPreview.types'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

export type HomePageEntityPreviewState = {
  items: HomePageEntityPreviewItem[]
  totalItems: number
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  onRetry: () => void
}

export type UseHomePageRightSidebarOptions = HomePageRightSidebarProps

export type UseHomePageRightSidebarResult = {
  friends: HomePageEntityPreviewState
  communities: HomePageEntityPreviewState
  suggestedCommunities: HomePageEntityPreviewItem[]
}

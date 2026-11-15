import type {
  HomePagePreviewItem,
  HomePageRightSidebarProps
} from './HomePageRightSidebar.types'

export type HomePageEntityPreviewState = {
  items: HomePagePreviewItem[]
  totalItems: number
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  isEmpty: boolean
  onRetry?: () => void
}

export type UseHomePageRightSidebarOptions = HomePageRightSidebarProps

export type UseHomePageRightSidebarResult = {
  friends: HomePageEntityPreviewState
  communities: HomePageEntityPreviewState
  suggestedCommunities: HomePagePreviewItem[]
}

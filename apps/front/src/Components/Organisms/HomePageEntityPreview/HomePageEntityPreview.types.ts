export type HomePageEntityPreviewItem = {
  id: string
  name: string
  url: string
  picture: string
}

export type HomePageEntityPreviewProps = {
  title: string
  items: HomePageEntityPreviewItem[]
  totalItems?: number
  emptyMessage: string
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  onRetry: () => void
  viewAllHref?: string
  viewAllLabel?: string
  getHref: (item: HomePageEntityPreviewItem) => string
  getSecondary: (item: HomePageEntityPreviewItem) => string
}

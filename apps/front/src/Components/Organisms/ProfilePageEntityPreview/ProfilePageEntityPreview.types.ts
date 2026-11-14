export type ProfilePageEntityPreviewEntry = {
  id: string
  name: string
  picture: string
  href: string
}

export type ProfilePageEntityPreviewProps = {
  title: string
  totalItems: number | undefined
  allHref: string
  allLabel: string
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  isSuccess: boolean
  emptyMessage: string
  onRetry: () => void
  entries: ProfilePageEntityPreviewEntry[]
}

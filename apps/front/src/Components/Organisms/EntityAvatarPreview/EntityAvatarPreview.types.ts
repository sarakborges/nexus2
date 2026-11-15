import type { IdentityAvatarGridEntry } from '@/Components/Molecules/IdentityAvatarGrid'

export type EntityAvatarPreviewProps = {
  title: string
  totalItems: number | undefined
  allHref: string
  allLabel: string
  isLoading: boolean
  isFetching: boolean
  isError: boolean
  isEmpty: boolean
  emptyMessage: string
  onRetry: () => void
  entries: IdentityAvatarGridEntry[]
}

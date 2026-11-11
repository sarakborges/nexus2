import type { Profile } from '@nexus/common'
import type { ProfileMessageViewModel } from './ProfileMessageItem.types'

export type ProfileMessageListProps = {
  items: ProfileMessageViewModel[]
  isActionPending: boolean
  onDelete: (item: ProfileMessageViewModel) => void
  onFavorite: (item: ProfileMessageViewModel) => void
  onReply: (sender: Profile) => void
}

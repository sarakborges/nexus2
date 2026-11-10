import type { Profile, ProfileMessage } from '@nexus/common'

export type ProfileMessageViewModel = {
  message: ProfileMessage
  sender: Profile | undefined
  canDelete: boolean
  canFavorite: boolean
  canReply: boolean
}

export type ProfileMessageListProps = {
  items: ProfileMessageViewModel[]
  isActionPending: boolean
  onDelete: (item: ProfileMessageViewModel) => void
  onFavorite: (item: ProfileMessageViewModel) => void
  onReply: (sender: Profile) => void
}

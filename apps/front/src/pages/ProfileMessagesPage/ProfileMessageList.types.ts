import type { Profile, ProfileMessage } from '@nexus/common'

export type ProfileMessageViewModel = {
  message: ProfileMessage
  sender: Profile | undefined
}

export type ProfileMessageListProps = {
  items: ProfileMessageViewModel[]
}

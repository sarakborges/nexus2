import type { Profile } from '@nexus/common'

export type ProfileSwitcherProps = {
  profiles: Profile[]
  currentProfileId: string | null
  isOpen: boolean
  isRequestPending: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  onToggle: () => void
  onRetry: () => void
  onSelect: (profileId: string) => void
}

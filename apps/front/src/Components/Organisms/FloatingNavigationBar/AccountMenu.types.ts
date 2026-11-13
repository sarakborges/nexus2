import type { Profile } from '@nexus/common'

export type AccountMenuProps = {
  profiles: Profile[]
  hasProfiles: boolean
  currentProfileId: string | null
  currentProfile: Profile | null
  editProfileRoute: string | null
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  isProfileSwitcherOpen: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  isSigningOut: boolean
  onToggleProfileSwitcher: () => void
  onRetryProfiles: () => void
  onSelectProfile: (profileId: string) => void
  onOpenSettings: () => void
  onOpenProfileSettings: (profileUrl: string) => void
  onSignOut: () => void
  onClose: () => void
}

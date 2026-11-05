import type { Profile } from '@nexus/common'

export type AccountMenuProps = {
  accountName: string
  profiles: Profile[]
  currentProfileId: string | null
  currentProfile: Profile | null
  editProfileRoute: string | null
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  isProfileSwitcherOpen: boolean
  isRequestPending: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  isSigningOut: boolean
  onToggleProfileSwitcher: () => void
  onRetryProfiles: () => void
  onSelectProfile: (profileId: string) => void
  onOpenSettings: () => void
  onSignOut: () => void
  onClose: () => void
}

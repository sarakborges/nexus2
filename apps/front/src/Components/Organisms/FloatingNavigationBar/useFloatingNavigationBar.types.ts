import type { Profile } from '@nexus/common'
import type { RefObject } from 'react'

export type UseFloatingNavigationBarOptions = {
  onOpenSettings: () => void
}

export type NavigationPanel = 'navigation' | 'account'

export type OpenPanel = {
  panel: NavigationPanel
  pathname: string
} | null

export type UseFloatingNavigationBarResult = {
  isAuthenticated: boolean
  navigationRef: RefObject<HTMLDivElement | null>
  isRequestPending: boolean
  activePanel: NavigationPanel | null
  pathname: string
  currentProfile: Profile | undefined
  profileRoute: string | null
  messagesRoute: string | null
  communitiesRoute: string | null
  editProfileRoute: string | null
  accountName: string
  closePanels: () => void
  togglePanel: (panel: NavigationPanel) => void
  toggleProfileSwitcher: () => void
  profiles: Profile[]
  currentProfileId: string | null
  isProfileSwitcherOpen: boolean
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  isSigningOut: boolean
  retryProfiles: () => void
  selectProfile: (profileId: string) => void
  handleOpenSettings: () => void
  handleSignOut: () => void
}

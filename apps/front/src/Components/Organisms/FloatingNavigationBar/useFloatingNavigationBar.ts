import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router'

import type {
  NavigationPanel,
  OpenPanel,
  UseFloatingNavigationBarOptions,
  UseFloatingNavigationBarResult
} from './useFloatingNavigationBar.types'
import { useDeleteAccountMutation, useSetCurrentProfileMutation, useSignOutMutation } from '@/Hooks/Auth'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthSessionState } from '@/Hooks/Auth'
import { useToastStore } from '@/Stores/Toast.store'

export function useFloatingNavigationBar({
  onOpenSettings
}: UseFloatingNavigationBarOptions): UseFloatingNavigationBarResult {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const navigationRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false)
  const [isDeleteAccountConfirmationOpen, setIsDeleteAccountConfirmationOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 680px)').matches
  )
  const activePanel =
    openPanel?.pathname === location.pathname ? openPanel.panel : null
  const session = useAuthSessionState((state) => state.session)
  const showToast = useToastStore((state) => state.showToast)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const currentProfile = session?.currentProfile ?? undefined

  const otherProfileIds = profileIds.filter(
    (profileId) => profileId !== currentProfileId
  )
  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(otherProfileIds),
    queryFn: () => getProfilesByIds(otherProfileIds),
    enabled: otherProfileIds.length > 0 && isProfileSwitcherOpen,
    staleTime: 5 * 60 * 1000
  })

  const otherProfilesById = new Map(
    (profilesQuery.data ?? []).map((profile) => [profile.id, profile] as const)
  )
  const profiles = profileIds.flatMap((profileId) => {
    const profile = profileId === currentProfileId
      ? currentProfile
      : otherProfilesById.get(profileId)
    return profile ? [profile] : []
  })
  const profileRoute = currentProfile
    ? ROUTES.profile + '/' + currentProfile.url
    : null
  const messagesRoute = currentProfile
    ? ROUTES.profile + '/' + currentProfile.url + '/messages'
    : null
  const communitiesRoute = currentProfile
    ? ROUTES.profile + '/' + currentProfile.url + '/communities'
    : null
  const editProfileRoute = currentProfile
    ? ROUTES.profile + '/' + currentProfile.url + '/edit'
    : null

  const closePanels = () => {
    setOpenPanel(null)
    setIsProfileSwitcherOpen(false)
  }

  const togglePanel = (panel: NavigationPanel) => {
    setIsProfileSwitcherOpen(false)
    setOpenPanel((current) =>
      current?.pathname === location.pathname && current.panel === panel
        ? null
        : { panel, pathname: location.pathname }
    )
  }

  const signOutMutation = useSignOutMutation()
  const profileSelectionMutation = useSetCurrentProfileMutation()
  const deleteAccountMutation = useDeleteAccountMutation()

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('has-global-navigation')
    root.classList.toggle('global-navigation-collapsed', isSidebarCollapsed)
    return () => {
      root.classList.remove(
        'has-global-navigation',
        'global-navigation-collapsed'
      )
    }
  }, [isSidebarCollapsed])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node) || !navigationRef.current?.contains(target)) {
        setOpenPanel(null)
        setIsProfileSwitcherOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPanel(null)
        setIsProfileSwitcherOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleOpenSettings = () => {
    closePanels()
    onOpenSettings()
  }

  const requestDeleteAccount = () => {
    closePanels()
    setIsDeleteAccountConfirmationOpen(true)
  }

  const cancelDeleteAccount = () => {
    if (!deleteAccountMutation.isPending) setIsDeleteAccountConfirmationOpen(false)
  }

  const confirmDeleteAccount = () => {
    if (deleteAccountMutation.isPending) return
    deleteAccountMutation.mutate(undefined, {
      onSuccess: () => {
        setIsDeleteAccountConfirmationOpen(false)
        showToast(t('ACCOUNT_DELETE_SUCCESS'))
        navigate(ROUTES.signIn, { replace: true })
      },
      onError: () => showToast(t('ACCOUNT_DELETE_ERROR'), 'error')
    })
  }

  const handleSignOut = () => {
    closePanels()
    signOutMutation.mutate(undefined, {
      onSuccess: () => navigate(ROUTES.signIn, { replace: true })
    })
  }

  return {
    isAuthenticated: Boolean(session),
    navigationRef,
    activePanel,
    pathname: location.pathname,
    currentProfile,
    profileRoute,
    messagesRoute,
    communitiesRoute,
    editProfileRoute,
    isSidebarCollapsed,
    closePanels,
    closeNavigationAfterNavigate: () => {
      closePanels()
      if (window.matchMedia('(max-width: 680px)').matches) {
        setIsSidebarCollapsed(true)
      }
    },
    collapseSidebar: () => setIsSidebarCollapsed(true),
    toggleSidebar: () => setIsSidebarCollapsed(value => !value),
    togglePanel,
    toggleProfileSwitcher: () =>
      setIsProfileSwitcherOpen((open) => !open),
    profiles,
    hasProfiles: profileIds.length > 0,
    currentProfileId,
    isProfileSwitcherOpen,
    profilesLoading: Boolean(currentProfileId && !currentProfile) ||
      (isProfileSwitcherOpen && otherProfileIds.length > 0 && profilesQuery.isLoading),
    profilesError: profilesQuery.isError,
    profilesSuccess: Boolean(currentProfile) || profilesQuery.isSuccess,
    isSelectionPending: profileSelectionMutation.isPending,
    isSelectionError: profileSelectionMutation.isError,
    isSigningOut: signOutMutation.isPending,
    isDeletingAccount: deleteAccountMutation.isPending,
    isDeleteAccountConfirmationOpen,
    retryProfiles: () => void profilesQuery.refetch(),
    selectProfile: (profileId: string) =>
      profileSelectionMutation.mutate(profileId, {
        onSuccess: () => {
          showToast(t('TOAST_PROFILE_SWITCHED'))
          closePanels()
        }
      }),
    handleOpenSettings,
    handleSignOut,
    requestDeleteAccount,
    cancelDeleteAccount,
    confirmDeleteAccount
  }
}

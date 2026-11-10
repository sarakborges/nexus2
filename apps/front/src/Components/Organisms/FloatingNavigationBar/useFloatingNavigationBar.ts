import { useQuery } from '@tanstack/react-query'

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type {
  NavigationPanel,
  OpenPanel,
  UseFloatingNavigationBarOptions,
  UseFloatingNavigationBarResult
} from './useFloatingNavigationBar.types'
import { useSetCurrentProfileMutation, useSignOutMutation } from '@/Hooks/Auth'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
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
  const activePanel =
    openPanel?.pathname === location.pathname ? openPanel.panel : null
  const session = useAuthStore((state) => state.session)
  const showToast = useToastStore((state) => state.showToast)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null

  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.byId(currentProfileId),
    queryFn: async () => {
      if (!currentProfileId) return null
      const [profile] = await getProfilesByIds([currentProfileId])
      return profile ?? null
    },
    enabled: Boolean(currentProfileId),
    staleTime: 5 * 60 * 1000
  })

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
      ? currentProfileQuery.data
      : otherProfilesById.get(profileId)
    return profile ? [profile] : []
  })
  const currentProfile = currentProfileQuery.data ?? undefined
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
  const accountName = currentProfile?.name ?? t('NAVIGATION_ACCOUNT')

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
    accountName,
    closePanels,
    togglePanel,
    toggleProfileSwitcher: () =>
      setIsProfileSwitcherOpen((open) => !open),
    profiles,
    hasProfiles: profileIds.length > 0,
    currentProfileId,
    isProfileSwitcherOpen,
    profilesLoading: profilesQuery.isLoading || currentProfileQuery.isLoading,
    profilesError: profilesQuery.isError || currentProfileQuery.isError,
    profilesSuccess: profilesQuery.isSuccess || currentProfileQuery.isSuccess,
    isSelectionPending: profileSelectionMutation.isPending,
    isSelectionError: profileSelectionMutation.isError,
    isSigningOut: signOutMutation.isPending,
    retryProfiles: () => {
      void currentProfileQuery.refetch()
      void profilesQuery.refetch()
    },
    selectProfile: (profileId: string) =>
      profileSelectionMutation.mutate(profileId, {
        onSuccess: () => {
          showToast(t('TOAST_PROFILE_SWITCHED'))
          closePanels()
        }
      }),
    handleOpenSettings,
    handleSignOut
  }
}

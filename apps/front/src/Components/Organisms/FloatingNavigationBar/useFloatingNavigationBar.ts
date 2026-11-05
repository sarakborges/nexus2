import {
  useIsFetching,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type { FloatingNavigationBarProps, OpenPanel } from './FloatingNavigationBar.types'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

export function useFloatingNavigationBar({
  onOpenSettings
}: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const navigationRef = useRef<HTMLDivElement>(null)
  const isFetching = useIsFetching() > 0
  const isMutating = useIsMutating() > 0
  const isRequestPending = isFetching || isMutating
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false)
  const activePanel =
    openPanel?.pathname === location.pathname ? openPanel.panel : null
  const session = useAuthStore((state) => state.session)
  const signOut = useAuthStore((state) => state.signOut)
  const showToast = useToastStore((state) => state.showToast)
  const setCurrentProfile = useAuthStore((state) => state.setCurrentProfile)
  const profileIds = session?.user.profiles ?? []

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000
  })

  const currentProfileId = session?.user.currentProfile ?? null
  const profiles = profilesQuery.data ?? []
  const currentProfile = profiles.find(
    (profile) => profile.id === currentProfileId
  )
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

  const togglePanel = (panel: 'navigation' | 'account') => {
    setIsProfileSwitcherOpen(false)
    setOpenPanel((current) =>
      current?.pathname === location.pathname && current.panel === panel
        ? null
        : { panel, pathname: location.pathname }
    )
  }

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate(ROUTES.signIn, { replace: true })
    }
  })

  const profileSelectionMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const success = await setCurrentProfile(profileId)
      if (!success) throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
    },
    onSuccess: () => {
      queryClient.setQueryData(
        queryKeys.auth.session,
        useAuthStore.getState().session
      )
      showToast(t('TOAST_PROFILE_SWITCHED'))
      closePanels()
    }
  })

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) {
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
    signOutMutation.mutate()
  }

  return {
    isAuthenticated: Boolean(session),
    navigationRef,
    isRequestPending,
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
    currentProfileId,
    isProfileSwitcherOpen,
    profilesLoading: profilesQuery.isLoading,
    profilesError: profilesQuery.isError,
    profilesSuccess: profilesQuery.isSuccess,
    isSelectionPending: profileSelectionMutation.isPending,
    isSelectionError: profileSelectionMutation.isError,
    isSigningOut: signOutMutation.isPending,
    retryProfiles: () => void profilesQuery.refetch(),
    selectProfile: (profileId: string) =>
      profileSelectionMutation.mutate(profileId),
    handleOpenSettings,
    handleSignOut
  }
}

import type { FloatingNavigationBarProps, OpenPanel } from './FloatingNavigationBar.types'
import { AccountMenu } from './AccountMenu.component'
import {
  useIsFetching,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query'
import {
  FiChevronDown,
  FiHome,
  FiMenu,
  FiMessageCircle,
  FiUsers,
  FiX
} from 'react-icons/fi'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

import './FloatingNavigationBar.style.scss'

export function FloatingNavigationBar({
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

  if (!session) return null

  const handleOpenSettings = () => {
    closePanels()
    onOpenSettings()
  }

  return createPortal(
    <div className="floating-navigation" ref={navigationRef}>
      <div className="floating-navigation__bar">
        <div className="floating-navigation__content">
          <nav
            className="floating-navigation__desktop-links"
            aria-label={t('NAVIGATION_LABEL')}
          >
            {currentProfile?.url && (
              <>
                <Link
                  className="floating-navigation__desktop-link"
                  to={ROUTES.home}
                  aria-current={
                    location.pathname === ROUTES.home ? 'page' : undefined
                  }
                  onClick={closePanels}
                >
                  <FiHome aria-hidden="true" />
                  <span>{t('HOME_TITLE')}</span>
                </Link>
                {profileRoute && (
                  <Link
                    className="floating-navigation__desktop-link"
                    to={profileRoute}
                    aria-current={
                      location.pathname === profileRoute ? 'page' : undefined
                    }
                    onClick={closePanels}
                  >
                    <FiUsers aria-hidden="true" />
                    <span>{t('NAVIGATION_PROFILE')}</span>
                  </Link>
                )}
                {messagesRoute && (
                  <Link
                    className="floating-navigation__desktop-link"
                    to={messagesRoute}
                    aria-current={
                      location.pathname === messagesRoute ? 'page' : undefined
                    }
                    onClick={closePanels}
                  >
                    <FiMessageCircle aria-hidden="true" />
                    <span>{t('NAVIGATION_MESSAGES')}</span>
                  </Link>
                )}
                {communitiesRoute && (
                  <Link
                    className="floating-navigation__desktop-link"
                    to={communitiesRoute}
                    aria-current={
                      location.pathname === communitiesRoute
                        ? 'page'
                        : undefined
                    }
                    onClick={closePanels}
                  >
                    <FiUsers aria-hidden="true" />
                    <span>{t('COMMUNITIES_TITLE')}</span>
                  </Link>
                )}
              </>
            )}
          </nav>

          <button
            className="floating-navigation__icon-button"
            type="button"
            disabled={isRequestPending}
            aria-label={t('NAVIGATION_MENU')}
            aria-expanded={activePanel === 'navigation'}
            aria-controls="floating-navigation-menu"
            onClick={() => togglePanel('navigation')}
          >
            {activePanel === 'navigation' ? (
              <FiX aria-hidden="true" />
            ) : (
              <FiMenu aria-hidden="true" />
            )}
          </button>

          <button
            className="floating-navigation__account-trigger"
            type="button"
            disabled={isRequestPending}
            aria-label={t('NAVIGATION_ACCOUNT_MENU')}
            aria-expanded={activePanel === 'account'}
            aria-controls="floating-account-menu"
            onClick={() => togglePanel('account')}
          >
            <IdentityAvatar
              className="floating-navigation__avatar"
              name={accountName}
              picture={currentProfile?.picture ?? ''}
            />
            <span className="floating-navigation__account-label">
              <span>{accountName}</span>
            </span>
            <FiChevronDown
              className="floating-navigation__account-chevron"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {activePanel === 'navigation' && (
        <nav
          className="floating-navigation__menu floating-navigation__menu--navigation"
          id="floating-navigation-menu"
          aria-label={t('NAVIGATION_LABEL')}
        >
          <Link
            className="floating-navigation__menu-item"
            to={ROUTES.home}
            onClick={closePanels}
          >
            <FiHome aria-hidden="true" />
            <span>{t('HOME_TITLE')}</span>
          </Link>
          {profileRoute && (
            <Link
              className="floating-navigation__menu-item"
              to={profileRoute}
              onClick={closePanels}
            >
              <FiUsers aria-hidden="true" />
              <span>{t('NAVIGATION_PROFILE')}</span>
            </Link>
          )}
          {messagesRoute && (
            <Link
              className="floating-navigation__menu-item"
              to={messagesRoute}
              onClick={closePanels}
            >
              <FiMessageCircle aria-hidden="true" />
              <span>{t('NAVIGATION_MESSAGES')}</span>
            </Link>
          )}
          <Link
            className="floating-navigation__menu-item"
            to={ROUTES.communities}
            onClick={closePanels}
          >
            <FiUsers aria-hidden="true" />
            <span>{t('COMMUNITIES_TITLE')}</span>
          </Link>
        </nav>
      )}

      {activePanel === 'account' && (
        <AccountMenu
          accountName={accountName}
          profiles={profiles}
          currentProfileId={currentProfileId}
          currentProfile={currentProfile ?? null}
          editProfileRoute={editProfileRoute}
          profilesLoading={profilesQuery.isLoading}
          profilesError={profilesQuery.isError}
          profilesSuccess={profilesQuery.isSuccess}
          isProfileSwitcherOpen={isProfileSwitcherOpen}
          isRequestPending={isRequestPending}
          isSelectionPending={profileSelectionMutation.isPending}
          isSelectionError={profileSelectionMutation.isError}
          isSigningOut={signOutMutation.isPending}
          onToggleProfileSwitcher={() =>
            setIsProfileSwitcherOpen((open) => !open)
          }
          onRetryProfiles={() => void profilesQuery.refetch()}
          onSelectProfile={(profileId) =>
            profileSelectionMutation.mutate(profileId)
          }
          onOpenSettings={handleOpenSettings}
          onSignOut={() => {
            closePanels()
            signOutMutation.mutate()
          }}
          onClose={closePanels}
        />
      )}
    </div>,
    document.body
  )
}

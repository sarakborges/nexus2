import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsFetching, useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiCheck, FiChevronDown, FiHome, FiLogOut, FiMenu, FiMessageCircle,
  FiPlusCircle, FiSettings, FiUserPlus, FiUsers, FiX
} from 'react-icons/fi'
import { Link, useLocation, useNavigate } from 'react-router'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'

import './FloatingNavigationBar.style.scss'

type FloatingNavigationBarProps = {
  onOpenSettings: () => void
}

type OpenPanel = {
  panel: 'navigation' | 'account'
  pathname: string
} | null

export function FloatingNavigationBar({ onOpenSettings }: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const navigationRef = useRef<HTMLDivElement>(null)
  const isRequestPending = useIsFetching() > 0 || useIsMutating() > 0
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [isProfileSwitcherOpen, setIsProfileSwitcherOpen] = useState(false)
  const activePanel = openPanel?.pathname === location.pathname ? openPanel.panel : null
  const session = useAuthStore(state => state.session)
  const signOut = useAuthStore(state => state.signOut)
  const showToast = useToastStore(state => state.showToast)
  const setCurrentProfile = useAuthStore(state => state.setCurrentProfile)
  const profileIds = session?.user.profiles ?? []

  const profilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0,
    staleTime: 5 * 60 * 1000
  })

  const currentProfileId = session?.user.currentProfile ?? null
  const profiles = profilesQuery.data ?? []
  const currentProfile = profiles.find(profile => profile.id === currentProfileId)
  const profileRoute = currentProfile ? ROUTES.profile + '/' + currentProfile.url : null
  const messagesRoute = currentProfile ? ROUTES.profile + '/' + currentProfile.url + '/messages' : null
  const accountName = currentProfile?.name ?? t('NAVIGATION_ACCOUNT')
  const accountInitial = accountName.trim().charAt(0).toUpperCase()

  const closePanels = () => {
    setOpenPanel(null)
    setIsProfileSwitcherOpen(false)
  }

  const togglePanel = (panel: 'navigation' | 'account') => {
    setIsProfileSwitcherOpen(false)
    setOpenPanel(current =>
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
      queryClient.setQueryData(queryKeys.auth.session, useAuthStore.getState().session)
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
        <nav className="floating-navigation__desktop-links" aria-label={t('NAVIGATION_LABEL')}>
          <Link className="floating-navigation__desktop-link" to={ROUTES.home} aria-current={location.pathname === ROUTES.home ? 'page' : undefined} onClick={closePanels}>
            <FiHome aria-hidden="true" />
            <span>{t('HOME_TITLE')}</span>
          </Link>
          {profileRoute && (
            <Link className="floating-navigation__desktop-link" to={profileRoute} aria-current={location.pathname === profileRoute ? 'page' : undefined} onClick={closePanels}>
              <FiUsers aria-hidden="true" />
              <span>{t('NAVIGATION_PROFILE')}</span>
            </Link>
          )}
          {messagesRoute && (
            <Link className="floating-navigation__desktop-link" to={messagesRoute} aria-current={location.pathname === messagesRoute ? 'page' : undefined} onClick={closePanels}>
              <FiMessageCircle aria-hidden="true" />
              <span>{t('NAVIGATION_MESSAGES')}</span>
            </Link>
          )}
          <Link className="floating-navigation__desktop-link" to={ROUTES.communities} aria-current={location.pathname === ROUTES.communities ? 'page' : undefined} onClick={closePanels}>
            <FiUsers aria-hidden="true" />
            <span>{t('COMMUNITIES_TITLE')}</span>
          </Link>
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
          {activePanel === 'navigation' ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
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
          <span className="floating-navigation__avatar">
            {currentProfile?.picture
              ? <img src={currentProfile.picture} alt="" />
              : <span aria-hidden="true">{accountInitial}</span>}
          </span>
          <span className="floating-navigation__account-label">
            <span>{accountName}</span>
          </span>
          <FiChevronDown className="floating-navigation__account-chevron" aria-hidden="true" />
        </button>
      </div>

      {activePanel === 'navigation' && (
        <nav
          className="floating-navigation__menu floating-navigation__menu--navigation"
          id="floating-navigation-menu"
          aria-label={t('NAVIGATION_LABEL')}
        >
          <Link className="floating-navigation__menu-item" to={ROUTES.home} onClick={closePanels}>
            <FiHome aria-hidden="true" />
            <span>{t('HOME_TITLE')}</span>
          </Link>
          {profileRoute && (
            <Link className="floating-navigation__menu-item" to={profileRoute} onClick={closePanels}>
              <FiUsers aria-hidden="true" />
              <span>{t('NAVIGATION_PROFILE')}</span>
            </Link>
          )}
          {messagesRoute && (
            <Link className="floating-navigation__menu-item" to={messagesRoute} onClick={closePanels}>
              <FiMessageCircle aria-hidden="true" />
              <span>{t('NAVIGATION_MESSAGES')}</span>
            </Link>
          )}
          <Link className="floating-navigation__menu-item" to={ROUTES.communities} onClick={closePanels}>
            <FiUsers aria-hidden="true" />
            <span>{t('COMMUNITIES_TITLE')}</span>
          </Link>
        </nav>
      )}

      {activePanel === 'account' && (
        <div
          className="floating-navigation__menu floating-navigation__menu--account"
          id="floating-account-menu"
          role="menu"
          aria-label={t('NAVIGATION_ACCOUNT_MENU')}
        >
          <div className="floating-navigation__menu-heading">
            <span>{accountName}</span>
          </div>

          <div className="floating-navigation__profile-switcher">
            <button
              className="floating-navigation__menu-item floating-navigation__profile-toggle"
              type="button"
              disabled={isRequestPending}
              role="menuitem"
              aria-expanded={isProfileSwitcherOpen}
              aria-controls="floating-profile-switcher"
              onClick={() => setIsProfileSwitcherOpen(open => !open)}
            >
              <FiUsers aria-hidden="true" />
              <span>{t('NAVIGATION_SWITCH_PROFILE')}</span>
              <FiChevronDown
                className={isProfileSwitcherOpen ? 'floating-navigation__profile-chevron is-open' : 'floating-navigation__profile-chevron'}
                aria-hidden="true"
              />
            </button>

            {isProfileSwitcherOpen && (
              <div className="floating-navigation__profile-list" id="floating-profile-switcher" role="group" aria-label={t('NAVIGATION_SWITCH_PROFILE')}>
                {profilesQuery.isLoading && (
                  <p className="floating-navigation__profile-status" role="status">{t('NAVIGATION_PROFILES_LOADING')}</p>
                )}
                {profilesQuery.isError && (
                  <div className="floating-navigation__profile-status" role="alert">
                    <span>{t('NAVIGATION_PROFILES_ERROR')}</span>
                    <button type="button" disabled={isRequestPending} onClick={() => void profilesQuery.refetch()}>{t('NAVIGATION_PROFILES_RETRY')}</button>
                  </div>
                )}
                {profilesQuery.isSuccess && profiles.length === 0 && (
                  <p className="floating-navigation__profile-status">{t('HOME_PROFILES_EMPTY')}</p>
                )}
                {profiles.map(profile => {
                  const isCurrent = profile.id === currentProfileId
                  return (
                    <button
                      className="floating-navigation__profile-option"
                      key={profile.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      disabled={isRequestPending || profileSelectionMutation.isPending}
                      onClick={() => profileSelectionMutation.mutate(profile.id)}
                    >
                      <span className="floating-navigation__profile-avatar">
                        {profile.picture
                          ? <img src={profile.picture} alt="" />
                          : <span aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</span>}
                      </span>
                      <span className="floating-navigation__profile-name">{profile.name}</span>
                      {isCurrent && <FiCheck aria-label={t('HOME_CURRENT_PROFILE')} />}
                    </button>
                  )
                })}
                {profileSelectionMutation.isError && (
                  <p className="floating-navigation__profile-status floating-navigation__profile-status--error" role="alert">
                    {t('NAVIGATION_PROFILE_UPDATE_ERROR')}
                  </p>
                )}
              </div>
            )}
          </div>

          <Link className="floating-navigation__menu-item" to={ROUTES.createProfile} role="menuitem" onClick={closePanels}>
            <FiUserPlus aria-hidden="true" />
            <span>{t('HOME_CREATE_PROFILE')}</span>
          </Link>
          {currentProfile && (
            <Link className="floating-navigation__menu-item" to={ROUTES.createCommunity} role="menuitem" onClick={closePanels}>
              <FiPlusCircle aria-hidden="true" />
              <span>{t('COMMUNITIES_CREATE')}</span>
            </Link>
          )}

          <div className="floating-navigation__menu-divider" />

          <button
            className="floating-navigation__menu-item"
            type="button"
            disabled={isRequestPending}
            role="menuitem"
            onClick={handleOpenSettings}
          >
            <FiSettings aria-hidden="true" />
            <span>{t('SETTINGS_TITLE')}</span>
          </button>
          <button
            className="floating-navigation__menu-item floating-navigation__menu-item--danger"
            type="button"
            disabled={isRequestPending}
            role="menuitem"
            disabled={isRequestPending || signOutMutation.isPending}
            onClick={() => {
              closePanels()
              signOutMutation.mutate()
            }}
          >
            <FiLogOut aria-hidden="true" />
            <span>{signOutMutation.isPending ? t('NAVIGATION_SIGNING_OUT') : t('AUTH_SIGN_OUT')}</span>
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}

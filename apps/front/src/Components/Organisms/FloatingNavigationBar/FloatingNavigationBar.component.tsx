import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiChevronDown, FiHome, FiLogOut, FiMenu, FiMessageCircle, FiPlusCircle,
  FiSettings, FiUserPlus, FiUsers, FiX
} from 'react-icons/fi'
import { Link, useLocation, useNavigate } from 'react-router'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

import './FloatingNavigationBar.style.scss'

type FloatingNavigationBarProps = {
  onOpenSettings: () => void
}

type OpenPanel = 'navigation' | 'account' | null

export function FloatingNavigationBar({ onOpenSettings }: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const navigationRef = useRef<HTMLDivElement>(null)
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const session = useAuthStore(state => state.session)
  const signOut = useAuthStore(state => state.signOut)
  const currentProfileId = session?.user.currentProfile ?? null

  const currentProfileQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(currentProfileId ? [currentProfileId] : []),
    queryFn: () => getProfilesByIds(currentProfileId ? [currentProfileId] : []),
    enabled: Boolean(currentProfileId),
    staleTime: 5 * 60 * 1000
  })

  const currentProfile = currentProfileQuery.data?.find(profile => profile.id === currentProfileId)
  const profileRoute = currentProfile ? ROUTES.profile + '/' + currentProfile.url : null
  const messagesRoute = currentProfile ? ROUTES.profile + '/' + currentProfile.url + '/messages' : null
  const accountName = currentProfile?.name ?? session?.user.email ?? t('NAVIGATION_ACCOUNT')
  const accountInitial = accountName.trim().charAt(0).toUpperCase()

  const signOutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      queryClient.clear()
      navigate(ROUTES.signIn, { replace: true })
    }
  })

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!navigationRef.current?.contains(event.target as Node)) setOpenPanel(null)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  useEffect(() => {
    setOpenPanel(null)
  }, [location.pathname])

  if (!session) return null

  const closePanels = () => setOpenPanel(null)
  const handleOpenSettings = () => {
    closePanels()
    onOpenSettings()
  }

  return (
    <div className="floating-navigation" ref={navigationRef}>
      <div className="floating-navigation__bar">
        <button
          className="floating-navigation__icon-button"
          type="button"
          aria-label={t('NAVIGATION_MENU')}
          aria-expanded={openPanel === 'navigation'}
          aria-controls="floating-navigation-menu"
          onClick={() => setOpenPanel(current => current === 'navigation' ? null : 'navigation')}
        >
          {openPanel === 'navigation' ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>

        <Link className="floating-navigation__brand" to={ROUTES.home} onClick={closePanels}>
          <span className="floating-navigation__brand-mark" aria-hidden="true">N</span>
          <span>Nexus</span>
        </Link>

        <button
          className="floating-navigation__account-trigger"
          type="button"
          aria-label={t('NAVIGATION_ACCOUNT_MENU')}
          aria-expanded={openPanel === 'account'}
          aria-controls="floating-account-menu"
          onClick={() => setOpenPanel(current => current === 'account' ? null : 'account')}
        >
          <span className="floating-navigation__avatar">
            {currentProfile?.picture
              ? <img src={currentProfile.picture} alt="" />
              : <span aria-hidden="true">{accountInitial}</span>}
          </span>
          <span className="floating-navigation__account-label">
            <span>{accountName}</span>
            <small>{session.user.email}</small>
          </span>
          <FiChevronDown className="floating-navigation__account-chevron" aria-hidden="true" />
        </button>
      </div>

      {openPanel === 'navigation' && (
        <nav
          className="floating-navigation__menu floating-navigation__menu--navigation"
          id="floating-navigation-menu"
          aria-label={t('NAVIGATION_LABEL')}
        >
          <Link className="floating-navigation__menu-item" to={ROUTES.home} onClick={closePanels}>
            <FiHome aria-hidden="true" />
            <span>{t('HOME_TITLE')}</span>
          </Link>
          <Link className="floating-navigation__menu-item" to={ROUTES.communities} onClick={closePanels}>
            <FiUsers aria-hidden="true" />
            <span>{t('COMMUNITIES_TITLE')}</span>
          </Link>
          {currentProfile && (
            <Link className="floating-navigation__menu-item" to={ROUTES.createCommunity} onClick={closePanels}>
              <FiPlusCircle aria-hidden="true" />
              <span>{t('COMMUNITIES_CREATE')}</span>
            </Link>
          )}
          <Link className="floating-navigation__menu-item" to={ROUTES.createProfile} onClick={closePanels}>
            <FiUserPlus aria-hidden="true" />
            <span>{t('HOME_CREATE_PROFILE')}</span>
          </Link>
        </nav>
      )}

      {openPanel === 'account' && (
        <div
          className="floating-navigation__menu floating-navigation__menu--account"
          id="floating-account-menu"
          role="menu"
          aria-label={t('NAVIGATION_ACCOUNT_MENU')}
        >
          <div className="floating-navigation__menu-heading">
            <span>{accountName}</span>
            <small>{session.user.email}</small>
          </div>

          {profileRoute && (
            <Link className="floating-navigation__menu-item" to={profileRoute} role="menuitem" onClick={closePanels}>
              <FiUsers aria-hidden="true" />
              <span>{t('NAVIGATION_PROFILE')}</span>
            </Link>
          )}
          {messagesRoute && (
            <Link className="floating-navigation__menu-item" to={messagesRoute} role="menuitem" onClick={closePanels}>
              <FiMessageCircle aria-hidden="true" />
              <span>{t('NAVIGATION_MESSAGES')}</span>
            </Link>
          )}

          <div className="floating-navigation__menu-divider" />

          <button
            className="floating-navigation__menu-item"
            type="button"
            role="menuitem"
            onClick={handleOpenSettings}
          >
            <FiSettings aria-hidden="true" />
            <span>{t('SETTINGS_TITLE')}</span>
          </button>
          <button
            className="floating-navigation__menu-item floating-navigation__menu-item--danger"
            type="button"
            role="menuitem"
            disabled={signOutMutation.isPending}
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
    </div>
  )
}

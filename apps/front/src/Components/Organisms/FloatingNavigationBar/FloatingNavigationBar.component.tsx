import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router'
import { FiChevronDown, FiMenu, FiUser } from 'react-icons/fi'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { AccountMenu } from './AccountMenu.component'
import { FloatingNavigationSearch } from './FloatingNavigationSearch.component'
import { FloatingNavigationLinks } from './FloatingNavigationLinks.component'
import type { FloatingNavigationBarProps } from './FloatingNavigationBar.types'
import { useFloatingNavigationBar } from './useFloatingNavigationBar'

import './FloatingNavigationBar.style.scss'

export function FloatingNavigationBar({
  onOpenSettings
}: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const location = useLocation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 680px)').matches
  )
  const {
    isAuthenticated,
    navigationRef,
    activePanel,
    pathname,
    currentProfile,
    profileRoute,
    messagesRoute,
    communitiesRoute,
    editProfileRoute,
    accountName,
    closePanels,
    togglePanel,
    toggleProfileSwitcher,
    profiles,
    hasProfiles,
    currentProfileId,
    isProfileSwitcherOpen,
    profilesLoading,
    profilesError,
    profilesSuccess,
    isSelectionPending,
    isSelectionError,
    isSigningOut,
    retryProfiles,
    selectProfile,
    handleOpenSettings,
    handleSignOut
  } = useFloatingNavigationBar({ onOpenSettings })

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

  if (!isAuthenticated) return null

  return createPortal(
    <div
      className={`floating-navigation ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
      ref={navigationRef}
    >
      <header className="floating-navigation__bar">
        <div className="floating-navigation__content">
          <button
            className="floating-navigation__icon-button"
            type="button"
            aria-label={t('NAVIGATION_MENU')}
            aria-expanded={!isSidebarCollapsed}
            aria-controls="floating-navigation-sidebar"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
          >
            <FiMenu aria-hidden="true" />
          </button>
          <Link className="floating-navigation__brand" to={ROUTES.home}>
            <img
              src="/nexus-logo.png"
              alt=""
              aria-hidden="true"
            />
            <span>NEXUS</span>
          </Link>
          <FloatingNavigationSearch
            key={`${location.pathname}:${location.search}`}
          />
          <span className="floating-navigation__spacer" />
          <button
            className="floating-navigation__account-trigger"
            type="button"
            aria-label={t('NAVIGATION_ACCOUNT_MENU')}
            aria-expanded={activePanel === 'account'}
            aria-controls="floating-account-menu"
            onClick={() => togglePanel('account')}
          >
            <FiUser className="floating-navigation__account-icon" aria-hidden="true" />
            <span className="floating-navigation__account-label">
              <span>{accountName}</span>
            </span>
            <FiChevronDown
              className="floating-navigation__account-chevron"
              aria-hidden="true"
            />
          </button>
        </div>
      </header>
      <aside
        className="floating-navigation__sidebar"
        id="floating-navigation-sidebar"
        aria-label={t('NAVIGATION_LABEL')}
      >
        <FloatingNavigationLinks
          pathname={pathname}
          hasCurrentProfile={Boolean(currentProfile?.url)}
          profileRoute={profileRoute}
          messagesRoute={messagesRoute}
          communitiesRoute={communitiesRoute}
          onNavigate={closePanels}
        />
      </aside>
      {activePanel === 'account' && (
        <AccountMenu
          accountName={accountName}
          profiles={profiles}
          hasProfiles={hasProfiles}
          currentProfileId={currentProfileId}
          currentProfile={currentProfile ?? null}
          editProfileRoute={editProfileRoute}
          profilesLoading={profilesLoading}
          profilesError={profilesError}
          profilesSuccess={profilesSuccess}
          isProfileSwitcherOpen={isProfileSwitcherOpen}
          isSelectionPending={isSelectionPending}
          isSelectionError={isSelectionError}
          isSigningOut={isSigningOut}
          onToggleProfileSwitcher={toggleProfileSwitcher}
          onRetryProfiles={retryProfiles}
          onSelectProfile={selectProfile}
          onOpenSettings={handleOpenSettings}
          onSignOut={handleSignOut}
          onClose={closePanels}
        />
      )}
    </div>,
    document.body
  )
}

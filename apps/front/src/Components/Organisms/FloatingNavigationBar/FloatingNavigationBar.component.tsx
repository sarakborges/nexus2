import { AccountMenu } from './AccountMenu.component'
import type { FloatingNavigationBarProps } from './FloatingNavigationBar.types'
import { useFloatingNavigationBar } from './useFloatingNavigationBar'

import {
  FiChevronDown,
  FiHome,
  FiMenu,
  FiMessageCircle,
  FiUsers,
  FiX
} from 'react-icons/fi'

import { createPortal } from 'react-dom'
import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import './FloatingNavigationBar.style.scss'

export function FloatingNavigationBar({
  onOpenSettings
}: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const {
    isAuthenticated,
    navigationRef,
    isRequestPending,
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
    currentProfileId,
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

  if (!isAuthenticated) return null

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
                    pathname === ROUTES.home ? 'page' : undefined
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
                      pathname === profileRoute ? 'page' : undefined
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
                      pathname === messagesRoute ? 'page' : undefined
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
                      pathname === communitiesRoute
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
          profilesLoading={profilesLoading}
          profilesError={profilesError}
          profilesSuccess={profilesSuccess}
          isProfileSwitcherOpen={isProfileSwitcherOpen}
          isRequestPending={isRequestPending}
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

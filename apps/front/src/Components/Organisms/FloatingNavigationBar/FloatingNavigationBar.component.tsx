import { createPortal } from 'react-dom'
import {
  FiChevronDown,
  FiMenu,
  FiX
} from 'react-icons/fi'

import { IdentityAvatar } from '@/Components/Molecules'
import { useTranslations } from '@/Hooks/Language'
import { AccountMenu } from './AccountMenu.component'
import { FloatingNavigationLinks } from './FloatingNavigationLinks.component'
import type { FloatingNavigationBarProps } from './FloatingNavigationBar.types'
import { useFloatingNavigationBar } from './useFloatingNavigationBar'

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

  if (!isAuthenticated) return null

  return createPortal(
    <div className="floating-navigation" ref={navigationRef}>
      <div className="floating-navigation__bar">
        <div className="floating-navigation__content">
          <FloatingNavigationLinks
            variant="desktop"
            pathname={pathname}
            hasCurrentProfile={Boolean(currentProfile?.url)}
            profileRoute={profileRoute}
            messagesRoute={messagesRoute}
            communitiesRoute={communitiesRoute}
            onNavigate={closePanels}
          />

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
        <FloatingNavigationLinks
          variant="mobile"
          pathname={pathname}
          hasCurrentProfile={Boolean(currentProfile?.url)}
          profileRoute={profileRoute}
          messagesRoute={messagesRoute}
          communitiesRoute={null}
          onNavigate={closePanels}
        />
      )}

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

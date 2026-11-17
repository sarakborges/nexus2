import { createPortal } from 'react-dom'
import { Link, useLocation } from 'react-router'
import { FiChevronDown, FiMenu, FiUser } from 'react-icons/fi'

import { Button } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
import { IdentityAvatar } from '@/Components/Atoms/IdentityAvatar'
import { useTranslations } from '@/Hooks/Language'
import { AccountMenu } from '@/Components/Organisms/AccountMenu'
import { NotificationsMenu } from '@/Components/Organisms/NotificationsMenu'
import { FloatingNavigationSearch } from '@/Components/Molecules/FloatingNavigationSearch'
import { ActionConfirmationModal } from '@/Components/Molecules/ActionConfirmationModal'
import { FloatingNavigationLinks } from '@/Components/Organisms/FloatingNavigationLinks'
import type { FloatingNavigationBarProps } from './FloatingNavigationBar.types'
import { useFloatingNavigationBar } from './useFloatingNavigationBar'

import './FloatingNavigationBar.style.scss'

export function FloatingNavigationBar({
  onOpenSettings,
  onOpenProfileSettings
}: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const location = useLocation()
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
    isSidebarCollapsed,
    closePanels,
    closeNavigationAfterNavigate,
    collapseSidebar,
    toggleSidebar,
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
    isDeletingAccount,
    isDeleteAccountConfirmationOpen,
    requestDeleteAccount,
    cancelDeleteAccount,
    confirmDeleteAccount,
    retryProfiles,
    selectProfile,
    handleOpenSettings,
    handleSignOut
  } = useFloatingNavigationBar({ onOpenSettings })

  if (!isAuthenticated) return null

  return createPortal(
    <div
      className={`floating-navigation ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
      ref={navigationRef}
    >
      <header className="floating-navigation__bar">
        <div className="floating-navigation__content">
          <Link className="floating-navigation__brand" to={ROUTES.home}>
            <img
              src="/nexus-logo.png"
              alt=""
              aria-hidden="true"
            />
            <span>NEXUS</span>
          </Link>
          <FloatingNavigationSearch
            key={location.pathname + ':' + location.search}
          />
          <span className="floating-navigation__spacer" />
          <div className="floating-navigation__notification-container">
            <NotificationsMenu
              isOpen={activePanel === 'notifications'}
              onToggle={() => togglePanel('notifications')}
              onClose={closePanels}
            />
          </div>
          <Button
            variation="transparent"
            className="floating-navigation__account-trigger"
            type="button"
            aria-label={t('NAVIGATION_ACCOUNT_MENU')}
            aria-expanded={activePanel === 'account'}
            aria-controls="floating-account-menu"
            onClick={() => togglePanel('account')}
          >
            {currentProfile ? (
              <IdentityAvatar
                className="floating-navigation__topbar-avatar"
                name={currentProfile.name}
                picture={currentProfile.picture}
              />
            ) : (
              <FiUser className="floating-navigation__account-icon" aria-hidden="true" />
            )}
            <FiChevronDown
              className="floating-navigation__account-chevron"
              aria-hidden="true"
            />
          </Button>
        </div>
      </header>
      {!isSidebarCollapsed && (
        <button
          className="floating-navigation__sidebar-backdrop"
          type="button"
          aria-label={t('SETTINGS_CLOSE')}
          onClick={() => {
            closePanels()
            collapseSidebar()
          }}
        />
      )}
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
          onNavigate={closeNavigationAfterNavigate}
        />
        <Button
          variation="transparent"
          className="floating-navigation__sidebar-toggle"
          type="button"
          aria-label={isSidebarCollapsed ? t('NAVIGATION_EXPAND_MENU') : t('NAVIGATION_COLLAPSE_MENU')}
          aria-expanded={!isSidebarCollapsed}
          aria-controls="floating-navigation-sidebar"
          onClick={toggleSidebar}
        >
          <FiMenu aria-hidden="true" />
          <span>{isSidebarCollapsed ? t('NAVIGATION_EXPAND_MENU') : t('NAVIGATION_COLLAPSE_MENU')}</span>
        </Button>
      </aside>
      {activePanel === 'account' && (
        <AccountMenu
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
          isDeletingAccount={isDeletingAccount}
          onRequestDeleteAccount={requestDeleteAccount}
          onToggleProfileSwitcher={toggleProfileSwitcher}
          onRetryProfiles={retryProfiles}
          onSelectProfile={selectProfile}
          onOpenSettings={handleOpenSettings}
          onOpenProfileSettings={onOpenProfileSettings}
          onSignOut={handleSignOut}
          onClose={closePanels}
        />
      )}
      <ActionConfirmationModal
        open={isDeleteAccountConfirmationOpen}
        title={t('ACCOUNT_DELETE_CONFIRM_TITLE')}
        description={t('ACCOUNT_DELETE_CONFIRM_DESCRIPTION')}
        confirmLabel={t('ACCOUNT_DELETE_CONFIRM_ACTION')}
        cancelLabel={t('ACTION_CANCEL')}
        closeLabel={t('SETTINGS_CLOSE')}
        isConfirming={isDeletingAccount}
        onConfirm={confirmDeleteAccount}
        onClose={cancelDeleteAccount}
      />
    </div>,
    document.body
  )
}

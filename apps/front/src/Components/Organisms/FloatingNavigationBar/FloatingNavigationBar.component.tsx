import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router'
import {
  FiChevronDown,
  FiMenu,
  FiSearch,
  FiX
} from 'react-icons/fi'
import type { SearchScope } from '@nexus/common'

import { ROUTES } from '@/Constants/routes'
import { IdentityAvatar } from '@/Components/Molecules'
import { useTranslations } from '@/Hooks/Language'
import { AccountMenu } from './AccountMenu.component'
import { FloatingNavigationLinks } from './FloatingNavigationLinks.component'
import type { FloatingNavigationBarProps } from './FloatingNavigationBar.types'
import { useFloatingNavigationBar } from './useFloatingNavigationBar'

import './FloatingNavigationBar.style.scss'

function FloatingNavigationSearch() {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchText, setSearchText] = useState(() => {
    if (location.pathname !== ROUTES.search) return ''
    return new URLSearchParams(location.search).get('query') ?? ''
  })
  const [searchScope, setSearchScope] = useState<SearchScope>(() => {
    if (location.pathname !== ROUTES.search) return 'all'
    const scope = new URLSearchParams(location.search).get('scope')
    return scope === 'profiles' || scope === 'communities' ? scope : 'all'
  })

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchText.trim()
    if (!query) return
    const params = new URLSearchParams({ query, scope: searchScope })
    navigate(`${ROUTES.search}?${params.toString()}`)
  }

  return (
    <form
      className="floating-navigation__search-form"
      role="search"
      onSubmit={handleSearch}
    >
      <input
        type="search"
        aria-label={t('SEARCH_PLACEHOLDER')}
        placeholder={t('SEARCH_PLACEHOLDER')}
        maxLength={120}
        value={searchText}
        onChange={event => setSearchText(event.target.value)}
      />
      <select
        aria-label={t('SEARCH_SCOPE_LABEL')}
        value={searchScope}
        onChange={event => setSearchScope(event.target.value as SearchScope)}
      >
        <option value="all">{t('SEARCH_SCOPE_ALL')}</option>
        <option value="profiles">{t('SEARCH_SCOPE_PROFILES')}</option>
        <option value="communities">{t('SEARCH_SCOPE_COMMUNITIES')}</option>
      </select>
      <button
        type="submit"
        aria-label={t('SEARCH_SUBMIT')}
        disabled={!searchText.trim()}
      >
        <FiSearch aria-hidden="true" />
      </button>
    </form>
  )
}

export function FloatingNavigationBar({
  onOpenSettings
}: FloatingNavigationBarProps) {
  const { t } = useTranslations()
  const location = useLocation()
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

          <FloatingNavigationSearch
            key={`${location.pathname}:${location.search}`}
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

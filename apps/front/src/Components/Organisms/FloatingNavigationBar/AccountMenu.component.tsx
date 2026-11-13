import { ProfileSwitcher } from './ProfileSwitcher.component'
import type { AccountMenuProps } from './AccountMenu.types'
import {
  FiEdit3,
  FiLogOut,
  FiPlusCircle,
  FiSettings,
  FiSliders,
  FiUserPlus
} from 'react-icons/fi'

import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

export function AccountMenu({
  accountName,
  profiles,
  hasProfiles,
  currentProfileId,
  currentProfile,
  editProfileRoute,
  profilesLoading,
  profilesError,
  profilesSuccess,
  isProfileSwitcherOpen,
  isSelectionPending,
  isSelectionError,
  isSigningOut,
  onToggleProfileSwitcher,
  onRetryProfiles,
  onSelectProfile,
  onOpenSettings,
  onOpenProfileSettings,
  onSignOut,
  onClose
}: AccountMenuProps) {
  const { t } = useTranslations()

  return (
    <div
      className="floating-navigation__menu floating-navigation__menu--account"
      id="floating-account-menu"
      role="menu"
      aria-label={t('NAVIGATION_ACCOUNT_MENU')}
    >
      <div className="floating-navigation__menu-heading">
        <span>{accountName}</span>
      </div>

      <ProfileSwitcher
        profiles={profiles}
        hasProfiles={hasProfiles}
        currentProfileId={currentProfileId}
        isOpen={isProfileSwitcherOpen}
        isSelectionPending={isSelectionPending}
        isSelectionError={isSelectionError}
        profilesLoading={profilesLoading}
        profilesError={profilesError}
        profilesSuccess={profilesSuccess}
        onToggle={onToggleProfileSwitcher}
        onRetry={onRetryProfiles}
        onSelect={onSelectProfile}
      />

      {editProfileRoute && (
        <Link
          className="floating-navigation__menu-item"
          to={editProfileRoute}
          role="menuitem"
          onClick={onClose}
        >
          <FiEdit3 aria-hidden="true" />
          <span>{t('PROFILE_EDIT')}</span>
        </Link>
      )}
      {currentProfile && (
        <>
          <button
            className="floating-navigation__menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              onOpenProfileSettings(currentProfile.url)
            }}
          >
            <FiSliders aria-hidden="true" />
            <span>{t('PROFILE_SETTINGS_TITLE')}</span>
          </button>
          <Link
            className="floating-navigation__menu-item"
            to={ROUTES.createProfile}
            role="menuitem"
            onClick={onClose}
          >
            <FiUserPlus aria-hidden="true" />
            <span>{t('HOME_CREATE_PROFILE')}</span>
          </Link>
          <Link
            className="floating-navigation__menu-item"
            to={ROUTES.createCommunity}
            role="menuitem"
            onClick={onClose}
          >
            <FiPlusCircle aria-hidden="true" />
            <span>{t('COMMUNITIES_CREATE')}</span>
          </Link>

          <div className="floating-navigation__menu-divider" />
        </>
      )}

      <button
        className="floating-navigation__menu-item"
        type="button"
        role="menuitem"
        onClick={onOpenSettings}
      >
        <FiSettings aria-hidden="true" />
        <span>{t('DISPLAY_SETTINGS_TITLE')}</span>
      </button>
      <button
        className="floating-navigation__menu-item floating-navigation__menu-item--danger"
        type="button"
        role="menuitem"
        disabled={isSigningOut}
        onClick={onSignOut}
      >
        <FiLogOut aria-hidden="true" />
        <span>
          {isSigningOut ? t('NAVIGATION_SIGNING_OUT') : t('AUTH_SIGN_OUT')}
        </span>
      </button>
    </div>
  )
}

import type { Profile } from '@nexus/common'
import {
  FiCheck,
  FiChevronDown,
  FiEdit3,
  FiLogOut,
  FiPlusCircle,
  FiSettings,
  FiUserPlus,
  FiUsers
} from 'react-icons/fi'

import { Link } from 'react-router'

import { IdentityAvatar } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

type ProfileSwitcherProps = {
  profiles: Profile[]
  currentProfileId: string | null
  isOpen: boolean
  isRequestPending: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  onToggle: () => void
  onRetry: () => void
  onSelect: (profileId: string) => void
}

function ProfileSwitcher({
  profiles,
  currentProfileId,
  isOpen,
  isRequestPending,
  isSelectionPending,
  isSelectionError,
  profilesLoading,
  profilesError,
  profilesSuccess,
  onToggle,
  onRetry,
  onSelect
}: ProfileSwitcherProps) {
  const { t } = useTranslations()

  if (!profiles.length) {
    return
  }

  return (
    <div className="floating-navigation__profile-switcher">
      <button
        className="floating-navigation__menu-item floating-navigation__profile-toggle"
        type="button"
        disabled={isRequestPending}
        role="menuitem"
        aria-expanded={isOpen}
        aria-controls="floating-profile-switcher"
        onClick={onToggle}
      >
        <FiUsers aria-hidden="true" />
        <span>{t('NAVIGATION_SWITCH_PROFILE')}</span>
        <FiChevronDown
          className={
            isOpen
              ? 'floating-navigation__profile-chevron is-open'
              : 'floating-navigation__profile-chevron'
          }
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="floating-navigation__profile-list"
          id="floating-profile-switcher"
          role="group"
          aria-label={t('NAVIGATION_SWITCH_PROFILE')}
        >
          {profilesLoading && (
            <p className="floating-navigation__profile-status" role="status">
              {t('NAVIGATION_PROFILES_LOADING')}
            </p>
          )}
          {profilesError && (
            <div className="floating-navigation__profile-status" role="alert">
              <span>{t('NAVIGATION_PROFILES_ERROR')}</span>
              <button
                type="button"
                disabled={isRequestPending}
                onClick={onRetry}
              >
                {t('NAVIGATION_PROFILES_RETRY')}
              </button>
            </div>
          )}
          {profilesSuccess && profiles.length === 0 && (
            <p className="floating-navigation__profile-status">
              {t('HOME_PROFILES_EMPTY')}
            </p>
          )}
          {profiles.map((profile) => {
            const isCurrent = profile.id === currentProfileId
            return (
              <button
                className="floating-navigation__profile-option"
                key={profile.id}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={isRequestPending || isSelectionPending}
                onClick={() => onSelect(profile.id)}
              >
                <IdentityAvatar
                  className="floating-navigation__profile-avatar"
                  name={profile.name}
                  picture={profile.picture}
                />
                <span className="floating-navigation__profile-name">
                  {profile.name}
                </span>
                {isCurrent && (
                  <FiCheck aria-label={t('HOME_CURRENT_PROFILE')} />
                )}
              </button>
            )
          })}
          {isSelectionError && (
            <p
              className="floating-navigation__profile-status floating-navigation__profile-status--error"
              role="alert"
            >
              {t('NAVIGATION_PROFILE_UPDATE_ERROR')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

type AccountMenuProps = {
  accountName: string
  profiles: Profile[]
  currentProfileId: string | null
  currentProfile: Profile | null
  editProfileRoute: string | null
  profilesLoading: boolean
  profilesError: boolean
  profilesSuccess: boolean
  isProfileSwitcherOpen: boolean
  isRequestPending: boolean
  isSelectionPending: boolean
  isSelectionError: boolean
  isSigningOut: boolean
  onToggleProfileSwitcher: () => void
  onRetryProfiles: () => void
  onSelectProfile: (profileId: string) => void
  onOpenSettings: () => void
  onSignOut: () => void
  onClose: () => void
}

export function AccountMenu({
  accountName,
  profiles,
  currentProfileId,
  currentProfile,
  editProfileRoute,
  profilesLoading,
  profilesError,
  profilesSuccess,
  isProfileSwitcherOpen,
  isRequestPending,
  isSelectionPending,
  isSelectionError,
  isSigningOut,
  onToggleProfileSwitcher,
  onRetryProfiles,
  onSelectProfile,
  onOpenSettings,
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
        currentProfileId={currentProfileId}
        isOpen={isProfileSwitcherOpen}
        isRequestPending={isRequestPending}
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
        disabled={isRequestPending}
        role="menuitem"
        onClick={onOpenSettings}
      >
        <FiSettings aria-hidden="true" />
        <span>{t('SETTINGS_TITLE')}</span>
      </button>
      <button
        className="floating-navigation__menu-item floating-navigation__menu-item--danger"
        type="button"
        role="menuitem"
        disabled={isRequestPending || isSigningOut}
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

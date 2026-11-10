import type { ProfileSwitcherProps } from './ProfileSwitcher.types'
import {
  FiCheck,
  FiChevronDown,
  FiUsers
} from 'react-icons/fi'

import { IdentityAvatar } from '@/Components/Molecules'
import { useTranslations } from '@/Hooks/Language'

export function ProfileSwitcher({
  profiles,
  hasProfiles,
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

  if (
    !hasProfiles &&
    !profiles.length &&
    !profilesLoading &&
    !profilesError &&
    !profilesSuccess
  ) {
    return null
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

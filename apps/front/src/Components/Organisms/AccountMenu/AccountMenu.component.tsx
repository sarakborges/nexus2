import { ProfileSwitcher } from '@/Components/Organisms/ProfileSwitcher'
import type { AccountMenuProps } from './AccountMenu.types'
import {
  FiCopy,
  FiEdit3,
  FiLogOut,
  FiPlusCircle,
  FiSettings,
  FiSliders,
  FiTrash2,
  FiUserPlus
} from 'react-icons/fi'

import { Link } from 'react-router'

import { Button } from '@/DesignSystem'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import './AccountMenu.style.scss'

export function AccountMenu({
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
  isDeletingAccount,
  onRequestDeleteAccount,
  onToggleProfileSwitcher,
  onRetryProfiles,
  onSelectProfile,
  onOpenSettings,
  onOpenProfileSettings,
  onSignOut,
  onClose
}: AccountMenuProps) {
  const { t } = useTranslations()
  const duplicateAbout = currentProfile?.about.replace(
    /<img\b(?=[^>]*\bsrc=(["'])[^"']*\/api\/uploads\/[0-9a-f-]{36}\/content\1)[^>]*>/gi,
    ''
  ) ?? ''
  const hasManagedAvatar = Boolean(
    currentProfile?.picture.includes('/storage/v1/object/public/nexus-avatars/')
  )
  const duplicateMediaOmitted = Boolean(
    currentProfile && (hasManagedAvatar || duplicateAbout !== currentProfile.about)
  )

  return (
    <div
      className="floating-navigation__menu floating-navigation__menu--account"
      id="floating-account-menu"
      role="menu"
      aria-label={t('NAVIGATION_ACCOUNT_MENU')}
    >
      <div className="floating-navigation__menu-group">
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
          <Link
            className="floating-navigation__menu-item"
            to={ROUTES.createProfile}
            state={{
              duplicateProfile: {
                name: currentProfile.name,
                url: currentProfile.url + '-copy',
                picture: hasManagedAvatar ? '' : currentProfile.picture,
                about: duplicateAbout,
                type: currentProfile.type
              },
              duplicateMediaOmitted
            }}
            role="menuitem"
            onClick={onClose}
          >
            <FiCopy aria-hidden="true" />
            <span>{t('PROFILE_DUPLICATE')}</span>
          </Link>
        )}
      </div>

      <div className="floating-navigation__menu-group">
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
      </div>

      <div className="floating-navigation__menu-group">
        {currentProfile && (
          <Button
            variation="transparent"
            className="floating-navigation__menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              onClose()
              onOpenProfileSettings()
            }}
          >
            <FiSliders aria-hidden="true" />
            <span>{t('PROFILE_SETTINGS_TITLE')}</span>
          </Button>
        )}
        <Button
          variation="transparent"
          className="floating-navigation__menu-item"
          type="button"
          role="menuitem"
          onClick={() => {
            onClose()
            onOpenSettings()
          }}
        >
          <FiSettings aria-hidden="true" />
          <span>{t('DISPLAY_SETTINGS_TITLE')}</span>
        </Button>
      </div>

      <div className="floating-navigation__menu-group">
        <Button
          variation="transparent"
          className="floating-navigation__menu-item floating-navigation__menu-item--danger"
          type="button"
          role="menuitem"
          disabled={isDeletingAccount}
          onClick={onRequestDeleteAccount}
        >
          <FiTrash2 aria-hidden="true" />
          <span>{t('ACCOUNT_DELETE')}</span>
        </Button>
        <Button
          variation="transparent"
          className="floating-navigation__menu-item floating-navigation__menu-item--danger"
          type="button"
          role="menuitem"
          disabled={isSigningOut}
          onClick={onSignOut}
        >
          <FiLogOut aria-hidden="true" />
          <span>{isSigningOut ? t('NAVIGATION_SIGNING_OUT') : t('AUTH_SIGN_OUT')}</span>
        </Button>
      </div>
    </div>
  )
}

import { Link } from 'react-router'
import { FiCompass, FiHome, FiMessageCircle, FiUser, FiUsers } from 'react-icons/fi'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import type { FloatingNavigationLinksProps } from './FloatingNavigationLinks.types'

export function FloatingNavigationLinks({
  pathname,
  hasCurrentProfile,
  profileRoute,
  messagesRoute,
  communitiesRoute,
  onNavigate
}: FloatingNavigationLinksProps) {
  const { t } = useTranslations()

  return (
    <nav
      className="floating-navigation__sidebar-links"
      aria-label={t('NAVIGATION_LABEL')}
    >
      {hasCurrentProfile && (
        <>
          <Link
            className="floating-navigation__sidebar-link"
            to={ROUTES.home}
            aria-label={t('HOME_TITLE')}
            title={t('HOME_TITLE')}
            aria-current={pathname === ROUTES.home ? 'page' : undefined}
            onClick={onNavigate}
          >
            <FiHome aria-hidden="true" />
            <span>{t('HOME_TITLE')}</span>
          </Link>

          {profileRoute && (
            <Link
              className="floating-navigation__sidebar-link"
              to={profileRoute}
              aria-label={t('NAVIGATION_PROFILE')}
              title={t('NAVIGATION_PROFILE')}
              aria-current={pathname === profileRoute ? 'page' : undefined}
              onClick={onNavigate}
            >
              <FiUser aria-hidden="true" />
              <span>{t('NAVIGATION_PROFILE')}</span>
            </Link>
          )}

          {messagesRoute && (
            <Link
              className="floating-navigation__sidebar-link"
              to={messagesRoute}
              aria-label={t('NAVIGATION_MESSAGES')}
              title={t('NAVIGATION_MESSAGES')}
              aria-current={pathname === messagesRoute ? 'page' : undefined}
              onClick={onNavigate}
            >
              <FiMessageCircle aria-hidden="true" />
              <span>{t('NAVIGATION_MESSAGES')}</span>
            </Link>
          )}

          {profileRoute && (
            <Link
              className="floating-navigation__sidebar-link"
              to={`${profileRoute}/friends`}
              aria-label={t('PROFILE_FRIENDS_LINK')}
              title={t('PROFILE_FRIENDS_LINK')}
              aria-current={
                pathname === `${profileRoute}/friends` ? 'page' : undefined
              }
              onClick={onNavigate}
            >
              <FiUsers aria-hidden="true" />
              <span>{t('PROFILE_FRIENDS_LINK')}</span>
            </Link>
          )}

          {communitiesRoute && (
            <Link
              className="floating-navigation__sidebar-link"
              to={communitiesRoute}
              aria-label={t('COMMUNITIES_TITLE')}
              title={t('COMMUNITIES_TITLE')}
              aria-current={pathname === communitiesRoute ? 'page' : undefined}
              onClick={onNavigate}
            >
              <FiCompass aria-hidden="true" />
              <span>{t('COMMUNITIES_TITLE')}</span>
            </Link>
          )}
        </>
      )}
    </nav>
  )
}

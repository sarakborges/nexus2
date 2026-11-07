import { Link } from 'react-router'

import {
  FiHome,
  FiMessageCircle,
  FiUsers
} from 'react-icons/fi'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { FloatingNavigationLinksProps } from './FloatingNavigationLinks.types'

export function FloatingNavigationLinks({
  variant,
  pathname,
  hasCurrentProfile,
  profileRoute,
  messagesRoute,
  communitiesRoute,
  onNavigate
}: FloatingNavigationLinksProps) {
  const { t } = useTranslations()

  if (variant === 'desktop') {
    return (
      <nav
        className="floating-navigation__desktop-links"
        aria-label={t('NAVIGATION_LABEL')}
      >
        {hasCurrentProfile && (
          <>
            <Link
              className="floating-navigation__desktop-link"
              to={ROUTES.home}
              aria-current={pathname === ROUTES.home ? 'page' : undefined}
              onClick={onNavigate}
            >
              <FiHome aria-hidden="true" />
              <span>{t('HOME_TITLE')}</span>
            </Link>
            {profileRoute && (
              <Link
                className="floating-navigation__desktop-link"
                to={profileRoute}
                aria-current={pathname === profileRoute ? 'page' : undefined}
                onClick={onNavigate}
              >
                <FiUsers aria-hidden="true" />
                <span>{t('NAVIGATION_PROFILE')}</span>
              </Link>
            )}
            {messagesRoute && (
              <Link
                className="floating-navigation__desktop-link"
                to={messagesRoute}
                aria-current={pathname === messagesRoute ? 'page' : undefined}
                onClick={onNavigate}
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
                  pathname === communitiesRoute ? 'page' : undefined
                }
                onClick={onNavigate}
              >
                <FiUsers aria-hidden="true" />
                <span>{t('COMMUNITIES_TITLE')}</span>
              </Link>
            )}
          </>
        )}
      </nav>
    )
  }

  return (
    <nav
      className="floating-navigation__menu floating-navigation__menu--navigation"
      id="floating-navigation-menu"
      aria-label={t('NAVIGATION_LABEL')}
    >
      <Link
        className="floating-navigation__menu-item"
        to={ROUTES.home}
        onClick={onNavigate}
      >
        <FiHome aria-hidden="true" />
        <span>{t('HOME_TITLE')}</span>
      </Link>
      {profileRoute && (
        <Link
          className="floating-navigation__menu-item"
          to={profileRoute}
          onClick={onNavigate}
        >
          <FiUsers aria-hidden="true" />
          <span>{t('NAVIGATION_PROFILE')}</span>
        </Link>
      )}
      {messagesRoute && (
        <Link
          className="floating-navigation__menu-item"
          to={messagesRoute}
          onClick={onNavigate}
        >
          <FiMessageCircle aria-hidden="true" />
          <span>{t('NAVIGATION_MESSAGES')}</span>
        </Link>
      )}
      <Link
        className="floating-navigation__menu-item"
        to={ROUTES.communities}
        onClick={onNavigate}
      >
        <FiUsers aria-hidden="true" />
        <span>{t('COMMUNITIES_TITLE')}</span>
      </Link>
    </nav>
  )
}

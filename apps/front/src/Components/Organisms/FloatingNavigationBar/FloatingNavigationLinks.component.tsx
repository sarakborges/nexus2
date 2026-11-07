import {
  FiHome,
  FiMessageCircle,
  FiUsers
} from 'react-icons/fi'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { FloatingNavigationLink } from './FloatingNavigationLink.component'
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
            <FloatingNavigationLink
              className="floating-navigation__desktop-link"
              to={ROUTES.home}
              icon={<FiHome aria-hidden="true" />}
              label={t('HOME_TITLE')}
              isActive={pathname === ROUTES.home}
              onNavigate={onNavigate}
            />
            {profileRoute && (
              <FloatingNavigationLink
                className="floating-navigation__desktop-link"
                to={profileRoute}
                icon={<FiUsers aria-hidden="true" />}
                label={t('NAVIGATION_PROFILE')}
                isActive={pathname === profileRoute}
                onNavigate={onNavigate}
              />
            )}
            {messagesRoute && (
              <FloatingNavigationLink
                className="floating-navigation__desktop-link"
                to={messagesRoute}
                icon={<FiMessageCircle aria-hidden="true" />}
                label={t('NAVIGATION_MESSAGES')}
                isActive={pathname === messagesRoute}
                onNavigate={onNavigate}
              />
            )}
            {communitiesRoute && (
              <FloatingNavigationLink
                className="floating-navigation__desktop-link"
                to={communitiesRoute}
                icon={<FiUsers aria-hidden="true" />}
                label={t('COMMUNITIES_TITLE')}
                isActive={pathname === communitiesRoute}
                onNavigate={onNavigate}
              />
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
      <FloatingNavigationLink
        className="floating-navigation__menu-item"
        to={ROUTES.home}
        icon={<FiHome aria-hidden="true" />}
        label={t('HOME_TITLE')}
        onNavigate={onNavigate}
      />
      {profileRoute && (
        <FloatingNavigationLink
          className="floating-navigation__menu-item"
          to={profileRoute}
          icon={<FiUsers aria-hidden="true" />}
          label={t('NAVIGATION_PROFILE')}
          onNavigate={onNavigate}
        />
      )}
      {messagesRoute && (
        <FloatingNavigationLink
          className="floating-navigation__menu-item"
          to={messagesRoute}
          icon={<FiMessageCircle aria-hidden="true" />}
          label={t('NAVIGATION_MESSAGES')}
          onNavigate={onNavigate}
        />
      )}
      <FloatingNavigationLink
        className="floating-navigation__menu-item"
        to={ROUTES.communities}
        icon={<FiUsers aria-hidden="true" />}
        label={t('COMMUNITIES_TITLE')}
        onNavigate={onNavigate}
      />
    </nav>
  )
}

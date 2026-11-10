import { Link } from 'react-router'
import { FiHome, FiMessageCircle, FiUsers } from 'react-icons/fi'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { FloatingNavigationLinksProps } from './FloatingNavigationLinks.types'

export function FloatingNavigationLinks({pathname,hasCurrentProfile,profileRoute,messagesRoute,communitiesRoute,onNavigate}:FloatingNavigationLinksProps) {
  const {t}=useTranslations()
  return <nav className="floating-navigation__sidebar-links" aria-label={t('NAVIGATION_LABEL')}>
    {hasCurrentProfile && <>
      <Link className="floating-navigation__sidebar-link" to={ROUTES.home} aria-current={pathname===ROUTES.home?'page':undefined} onClick={onNavigate}><FiHome aria-hidden="true"/><span>{t('HOME_TITLE')}</span></Link>
      {profileRoute && <Link className="floating-navigation__sidebar-link" to={profileRoute} aria-current={pathname===profileRoute?'page':undefined} onClick={onNavigate}><FiUsers aria-hidden="true"/><span>{t('NAVIGATION_PROFILE')}</span></Link>}
      {messagesRoute && <Link className="floating-navigation__sidebar-link" to={messagesRoute} aria-current={pathname===messagesRoute?'page':undefined} onClick={onNavigate}><FiMessageCircle aria-hidden="true"/><span>{t('NAVIGATION_MESSAGES')}</span></Link>}
      {communitiesRoute && <Link className="floating-navigation__sidebar-link" to={communitiesRoute} aria-current={pathname===communitiesRoute?'page':undefined} onClick={onNavigate}><FiUsers aria-hidden="true"/><span>{t('COMMUNITIES_TITLE')}</span></Link>}
    </>}
  </nav>
}

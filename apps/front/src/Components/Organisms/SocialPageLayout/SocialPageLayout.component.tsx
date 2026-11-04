import type { ReactNode } from 'react'
import { Link } from 'react-router'

import type { Community, Profile } from '@nexus/common'
import { RelationshipActions } from '@/Components/Molecules/RelationshipActions'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import './SocialPageLayout.style.scss'

type SocialPageLayoutProps = {
  sidebar: ReactNode
  children: ReactNode
  rightSidebar?: ReactNode
  className?: string
}

type ProfileSidebarProps = {
  profile: Profile
  active: 'home' | 'profile' | 'friends' | 'communities' | 'messages' | 'community-list'
  showRelationshipActions?: boolean
}

type CommunitySidebarProps = {
  community: Community
  active: 'about' | 'members' | 'forum'
  canInteract?: boolean
}

export function SocialPageLayout({ sidebar, children, rightSidebar, className = '' }: SocialPageLayoutProps) {
  const columnsClass = rightSidebar ? '' : 'social-page__layout--two-column'
  return (
    <main className={['social-page', className].filter(Boolean).join(' ')}>
      <div className={['social-page__layout', columnsClass].filter(Boolean).join(' ')}>
        <aside className="social-page__left-column">{sidebar}</aside>
        <section className="social-page__main-column">{children}</section>
        {rightSidebar && <aside className="social-page__right-column">{rightSidebar}</aside>}
      </div>
    </main>
  )
}

export function ProfileSidebar({ profile, active, showRelationshipActions = true }: ProfileSidebarProps) {
  const { t } = useTranslations()
  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        <Link className="social-identity__link" to={ROUTES.profile + '/' + profile.url} aria-label={t('PROFILE_PICTURE_ALT', { name: profile.name })}>
          {profile.picture
            ? <img className="social-identity__picture social-identity__picture--profile" src={profile.picture} alt="" />
            : <span className="social-identity__picture social-identity__picture--fallback" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</span>}
        </Link>
        <h1 className="social-identity__name">{profile.name}</h1>
        {showRelationshipActions && <RelationshipActions targetId={profile.id} />}
      </section>
      <nav className="social-side-menu" aria-label={t('PROFILE_TITLE')}>
        <Link to={ROUTES.home} aria-current={active === 'home' ? 'page' : undefined}>{t('HOME_TITLE')}</Link>
        <Link to={ROUTES.profile + '/' + profile.url} aria-current={active === 'profile' ? 'page' : undefined}>{t('PROFILE_TITLE')}</Link>
        <Link to={ROUTES.profile + '/' + profile.url + '/friends'} aria-current={active === 'friends' ? 'page' : undefined}>{t('PROFILE_FRIENDS_LINK')}</Link>
        <Link to={ROUTES.profile + '/' + profile.url + '/communities'} aria-current={active === 'communities' ? 'page' : undefined}>{t('PROFILE_COMMUNITIES_LINK')}</Link>
        <Link to={ROUTES.profile + '/' + profile.url + '/messages'} aria-current={active === 'messages' ? 'page' : undefined}>{t('PROFILE_MESSAGES_LINK')}</Link>
      </nav>
    </div>
  )
}

export function CommunitySidebar({ community, active, canInteract = false }: CommunitySidebarProps) {
  const { t } = useTranslations()
  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        <Link className="social-identity__link" to={ROUTES.community + '/' + community.url} aria-label={t('COMMUNITY_PICTURE_ALT', { name: community.name })}>
          {community.picture
            ? <img className="social-identity__picture social-identity__picture--community" src={community.picture} alt="" />
            : <span className="social-identity__picture social-identity__picture--fallback" aria-hidden="true">{community.name.trim().charAt(0).toUpperCase()}</span>}
        </Link>
        <h1 className="social-identity__name">{community.name}</h1>
        {canInteract && <RelationshipActions targetId={community.id} targetKind="community" />}
      </section>
      <nav className="social-side-menu" aria-label={t('COMMUNITY_CREATE_TITLE')}>
        <Link to={ROUTES.community + '/' + community.url} aria-current={active === 'about' ? 'page' : undefined}>{t('COMMUNITY_ABOUT_LABEL')}</Link>
        <Link to={ROUTES.community + '/' + community.url + '/members'} aria-current={active === 'members' ? 'page' : undefined}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
        <Link to={ROUTES.community + '/' + community.url + '/forum'} aria-current={active === 'forum' ? 'page' : undefined}>{t('FORUM_TITLE')}</Link>
      </nav>
    </div>
  )
}

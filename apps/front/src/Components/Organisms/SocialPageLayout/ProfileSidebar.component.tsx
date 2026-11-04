import { Link } from 'react-router'

import type { Profile } from '@nexus/common'
import { IdentityAvatar, RelationshipActions } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

type ProfileSidebarProps = {
  profile: Profile
  active: 'home' | 'profile' | 'friends' | 'communities' | 'messages' | 'community-list'
  showRelationshipActions?: boolean
}

export function ProfileSidebar({ profile, active, showRelationshipActions = true }: ProfileSidebarProps) {
  const { t } = useTranslations()

  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        <Link className="social-identity__link" to={ROUTES.profile + '/' + profile.url} aria-label={t('PROFILE_PICTURE_ALT', { name: profile.name })}>
          <IdentityAvatar
            className="social-identity__picture social-identity__picture--profile"
            name={profile.name}
            picture={profile.picture}
          />
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

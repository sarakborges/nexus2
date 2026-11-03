import { Link } from 'react-router'
import type { Profile } from '@nexus/common'
import { RelationshipActions } from '@/Components/Molecules/RelationshipActions/RelationshipActions.component'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'

type ProfileSidebarSection = 'profile' | 'friends' | 'communities' | 'messages' | null

type ProfileSidebarProps = {
  profile: Profile
  activeSection?: ProfileSidebarSection
  canInteract?: boolean
  showRelationshipActions?: boolean
}

export function ProfileSidebar({
  profile,
  activeSection = null,
  canInteract = false,
  showRelationshipActions = false
}: ProfileSidebarProps) {
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const isOwner = session?.user.profiles.includes(profile.id) ?? false
  const profilePath = `${ROUTES.profile}/${profile.url}`

  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        {profile.picture
          ? <img className="social-identity__picture social-identity__picture--profile" src={profile.picture} alt={t('PROFILE_PICTURE_ALT', { name: profile.name })} />
          : <div className="social-identity__picture social-identity__picture--fallback social-identity__picture--profile" aria-hidden="true">{profile.name.trim().charAt(0).toUpperCase()}</div>}
        <h1 className="social-identity__name">{profile.name}</h1>
        {isOwner && <ButtonLink className="social-sidebar-card__edit" variation="secondary" to={`${profilePath}/edit`}>{t('PROFILE_CHANGE_PHOTO')}</ButtonLink>}
        {showRelationshipActions && canInteract && <RelationshipActions targetId={profile.id} />}
      </section>
      <nav className="social-side-menu" aria-label={t('PROFILE_TITLE')}>
        <Link to={profilePath} aria-current={activeSection === 'profile' ? 'page' : undefined}>{t('PROFILE_TITLE')}</Link>
        <Link to={`${profilePath}/messages`} aria-current={activeSection === 'messages' ? 'page' : undefined}>{t('PROFILE_MESSAGES_LINK')}</Link>
        <Link to={`${profilePath}/friends`} aria-current={activeSection === 'friends' ? 'page' : undefined}>{t('PROFILE_FRIENDS_LINK')}</Link>
        <Link to={`${profilePath}/communities`} aria-current={activeSection === 'communities' ? 'page' : undefined}>{t('PROFILE_COMMUNITIES_LINK')}</Link>
        {isOwner && <Link to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</Link>}
      </nav>
    </div>
  )
}

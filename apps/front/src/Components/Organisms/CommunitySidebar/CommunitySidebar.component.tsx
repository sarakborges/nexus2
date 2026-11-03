import { Link } from 'react-router'
import type { Community } from '@nexus/common'
import { RelationshipActions } from '@/Components/Molecules/RelationshipActions/RelationshipActions.component'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

type CommunitySidebarSection = 'about' | 'members' | 'forum'

type CommunitySidebarProps = {
  community: Community
  activeSection?: CommunitySidebarSection
  canInteract?: boolean
  isOwner?: boolean
}

export function CommunitySidebar({
  community,
  activeSection = 'about',
  canInteract = false,
  isOwner = false
}: CommunitySidebarProps) {
  const { t } = useTranslations()
  const communityPath = `${ROUTES.community}/${community.url}`

  return (
    <div className="social-sidebar-card social-sidebar-card--community">
      <section className="social-identity">
        {community.picture
          ? <img className="social-identity__picture social-identity__picture--community" src={community.picture} alt={t('COMMUNITY_PICTURE_ALT', { name: community.name })} />
          : <div className="social-identity__picture social-identity__picture--fallback social-identity__picture--community" aria-hidden="true">{community.name.trim().charAt(0).toUpperCase()}</div>}
        <h1 className="social-identity__name">{community.name}</h1>
        {isOwner && <ButtonLink className="social-sidebar-card__edit" variation="secondary" to={`${communityPath}/edit`}>{t('COMMUNITY_EDIT')}</ButtonLink>}
        {canInteract && <RelationshipActions targetId={community.id} targetKind="community" />}
      </section>
      <nav className="social-side-menu" aria-label={t('COMMUNITY_CREATE_TITLE')}>
        <Link to={communityPath} aria-current={activeSection === 'about' ? 'page' : undefined}>{t('COMMUNITY_ABOUT_LABEL')}</Link>
        <Link to={`${communityPath}/members`} aria-current={activeSection === 'members' ? 'page' : undefined}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
        <Link to={`${communityPath}/forum`} aria-current={activeSection === 'forum' ? 'page' : undefined}>{t('FORUM_TITLE')}</Link>
      </nav>
    </div>
  )
}

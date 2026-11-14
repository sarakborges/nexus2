import type { CommunitySidebarProps } from './CommunitySidebar.types'

import { Link } from 'react-router'

import { IdentityAvatar, RelationshipActions } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

export function CommunitySidebar({
  community,
  active,
  canInteract = false,
  relationship
}: CommunitySidebarProps) {
  const { t } = useTranslations()

  return (
    <div className="social-sidebar-card">
      <section className="social-identity">
        <Link
          className="social-identity__link"
          to={ROUTES.community + '/' + community.url}
          aria-label={t('COMMUNITY_PICTURE_ALT', { name: community.name })}
        >
          <IdentityAvatar
            className="social-identity__picture social-identity__picture--community"
            name={community.name}
            picture={community.picture}
          />
        </Link>
        <h1 className="social-identity__name">{community.name}</h1>
        {canInteract && (
          <RelationshipActions targetId={community.id} targetKind="community" relationship={relationship} />
        )}
      </section>
      <nav
        className="social-side-menu"
        aria-label={t('COMMUNITY_CREATE_TITLE')}
      >
        <Link
          to={ROUTES.community + '/' + community.url}
          aria-current={active === 'about' ? 'page' : undefined}
        >
          {t('COMMUNITY_ABOUT_LABEL')}
        </Link>
        <Link
          to={ROUTES.community + '/' + community.url + '/members'}
          aria-current={active === 'members' ? 'page' : undefined}
        >
          {t('COMMUNITY_MEMBERS_LINK')}
        </Link>
        <Link
          to={ROUTES.community + '/' + community.url + '/forum'}
          aria-current={active === 'forum' ? 'page' : undefined}
        >
          {t('FORUM_TITLE')}
        </Link>
      </nav>
    </div>
  )
}

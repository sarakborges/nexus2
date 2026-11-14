
import { SocialSidebar } from '@/Components/Molecules/SocialSidebar'
import { RelationshipActions } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { CommunitySidebarProps } from './CommunitySidebar.types'

export function CommunitySidebar({
  community,
  active,
  canInteract = false,
  relationship
}: CommunitySidebarProps) {
  const { t } = useTranslations()

  return (
    <SocialSidebar
      href={ROUTES.community + '/' + community.url}
      imageLabel={t('COMMUNITY_PICTURE_ALT', { name: community.name })}
      name={community.name}
      picture={community.picture}
      pictureVariant="community"
      relationshipActions={
        canInteract
          ? <RelationshipActions targetId={community.id} targetKind="community" relationship={relationship} />
          : null
      }
      navigationLabel={t('COMMUNITY_CREATE_TITLE')}
      navigationItems={[
        { href: ROUTES.community + '/' + community.url, label: t('COMMUNITY_ABOUT_LABEL'), isActive: active === 'about' },
        { href: ROUTES.community + '/' + community.url + '/members', label: t('COMMUNITY_MEMBERS_LINK'), isActive: active === 'members' },
        { href: ROUTES.community + '/' + community.url + '/forum', label: t('FORUM_TITLE'), isActive: active === 'forum' }
      ]}
    />
  )
}

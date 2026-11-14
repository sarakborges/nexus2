
import { SocialSidebar } from '@/Components/Molecules/SocialSidebar'
import { RelationshipActions } from '@/Components/Molecules'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileSidebarProps } from './ProfileSidebar.types'

export function ProfileSidebar({
  profile,
  active,
  showRelationshipActions = false,
  relationship
}: ProfileSidebarProps) {
  const { t } = useTranslations()

  return (
    <SocialSidebar
      href={ROUTES.profile + '/' + profile.url}
      imageLabel={t('PROFILE_PICTURE_ALT', { name: profile.name })}
      name={profile.name}
      picture={profile.picture}
      pictureVariant="profile"
      metadata={'@' + profile.url}
      relationshipActions={
        showRelationshipActions
          ? <RelationshipActions targetId={profile.id} relationship={relationship} />
          : null
      }
      navigationLabel={t('PROFILE_TITLE')}
      navigationItems={[
        { href: ROUTES.home, label: t('HOME_TITLE'), isActive: active === 'home' },
        { href: ROUTES.profile + '/' + profile.url, label: t('PROFILE_TITLE'), isActive: active === 'profile' },
        { href: ROUTES.profile + '/' + profile.url + '/messages', label: t('PROFILE_MESSAGES_LINK'), isActive: active === 'messages' },
        { href: ROUTES.profile + '/' + profile.url + '/friends', label: t('PROFILE_FRIENDS_LINK'), isActive: active === 'friends' },
        { href: ROUTES.profile + '/' + profile.url + '/communities', label: t('PROFILE_COMMUNITIES_LINK'), isActive: active === 'communities' }
      ]}
    />
  )
}

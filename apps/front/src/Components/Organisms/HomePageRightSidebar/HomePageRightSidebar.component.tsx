import { EntityAvatarPreview } from '@/Components/Organisms/EntityAvatarPreview'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useHomePageRightSidebar } from './useHomePageRightSidebar'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

import './HomePageRightSidebar.style.scss'

export function HomePageRightSidebar({
  currentProfile,
  suggestedCommunities
}: HomePageRightSidebarProps) {
  const { t } = useTranslations()
  const { friends, communities, suggestedCommunities: suggestions } =
    useHomePageRightSidebar({ currentProfile, suggestedCommunities })

  const friendEntries = friends.items.map(item => ({
    id: item.id,
    name: item.name,
    picture: item.picture,
    href: ROUTES.profile + '/' + item.url
  }))
  const communityEntries = communities.items.map(item => ({
    id: item.id,
    name: item.name,
    picture: item.picture,
    href: ROUTES.community + '/' + item.url
  }))
  const suggestedCommunityEntries = suggestions.map(item => ({
    id: item.id,
    name: item.name,
    picture: item.picture,
    href: ROUTES.community + '/' + item.url
  }))

  return (
    <div className="home-page__previews">
      <EntityAvatarPreview
        title={t('PROFILE_FRIENDS_TITLE')}
        totalItems={friends.totalItems}
        isLoading={friends.isLoading}
        isFetching={friends.isFetching}
        isError={friends.isError}
        isEmpty={friends.isEmpty}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        onRetry={friends.onRetry}
        allHref={ROUTES.profile + '/' + currentProfile.url + '/friends'}
        allLabel={t('COMMON_VIEW_ALL')}
        entries={friendEntries}
      />
      <EntityAvatarPreview
        title={t('PROFILE_COMMUNITIES_TITLE')}
        totalItems={communities.totalItems}
        isLoading={communities.isLoading}
        isFetching={communities.isFetching}
        isError={communities.isError}
        isEmpty={communities.isEmpty}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        onRetry={communities.onRetry}
        allHref={ROUTES.profile + '/' + currentProfile.url + '/communities'}
        allLabel={t('COMMON_VIEW_ALL')}
        entries={communityEntries}
      />
      <EntityAvatarPreview
        title={t('HOME_SUGGESTED_COMMUNITIES')}
        totalItems={suggestions.length}
        isLoading={false}
        isFetching={false}
        isError={false}
        isEmpty={suggestions.length === 0}
        emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
        entries={suggestedCommunityEntries}
      />
    </div>
  )
}

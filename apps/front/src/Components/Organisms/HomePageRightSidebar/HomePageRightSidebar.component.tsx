import { HomePageEntityPreview } from '@/Components/Organisms/HomePageEntityPreview'
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

  return (
    <div className="home-page__previews">
      <HomePageEntityPreview
        title={t('PROFILE_FRIENDS_TITLE')}
        items={friends.items}
        totalItems={friends.totalItems}
        emptyMessage={t('RELATIONSHIP_FRIENDS_EMPTY')}
        isLoading={friends.isLoading}
        isFetching={friends.isFetching}
        isError={friends.isError}
        onRetry={friends.onRetry}
        viewAllHref={ROUTES.profile + '/' + currentProfile.url + '/friends'}
        viewAllLabel={t('COMMON_VIEW_ALL')}
        getHref={item => ROUTES.profile + '/' + item.url}
        getSecondary={item => '@' + item.url}
      />
      <HomePageEntityPreview
        title={t('PROFILE_COMMUNITIES_TITLE')}
        items={communities.items}
        totalItems={communities.totalItems}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        isLoading={communities.isLoading}
        isFetching={communities.isFetching}
        isError={communities.isError}
        onRetry={communities.onRetry}
        viewAllHref={ROUTES.profile + '/' + currentProfile.url + '/communities'}
        viewAllLabel={t('COMMON_VIEW_ALL')}
        getHref={item => ROUTES.community + '/' + item.url}
        getSecondary={item => '/community/' + item.url}
      />
      <HomePageEntityPreview
        title={t('HOME_SUGGESTED_COMMUNITIES')}
        items={suggestions}
        emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
        isLoading={false}
        isFetching={false}
        isError={false}
        getHref={item => ROUTES.community + '/' + item.url}
        getSecondary={item => '/community/' + item.url}
      />
    </div>
  )
}

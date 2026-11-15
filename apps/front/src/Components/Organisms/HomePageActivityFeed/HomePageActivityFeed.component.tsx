import { RequestState } from '@/Components/Molecules/RequestState'
import { HomePageActivityEntry } from '@/Components/Molecules/HomePageActivityEntry'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useHomePageActivityFeed } from './useHomePageActivityFeed'
import type { HomePageActivityFeedProps } from './HomePageActivityFeed.types'

import './HomePageActivityFeed.style.scss'

export function HomePageActivityFeed({
  homeQuery,
  activities,
  activityCursor,
  hasMoreActivities,
  formatDate
}: HomePageActivityFeedProps) {
  const { t } = useTranslations()
  const {
    loadedActivities,
    hasMore,
    isLoadingMore,
    sentinelRef,
    loadMore
  } = useHomePageActivityFeed({
    activities,
    activityCursor,
    hasMoreActivities
  })

  return (
    <section className="home-page__activity" aria-labelledby="home-activity-title">
      <h2 className="home-page__activity-title" id="home-activity-title">
        {t('HOME_ACTIVITY_TITLE')}
      </h2>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && loadedActivities.length === 0}
        emptyMessage={t('HOME_ACTIVITY_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__activity-list">
          {loadedActivities.map(activity => (
            <HomePageActivityEntry
              key={activity.id}
              activity={activity}
              formatDate={formatDate}
            />
          ))}
        </div>
        {hasMore && (
          <div className="home-page__activity-more" ref={sentinelRef}>
            <Button
              type="button"
              variation="secondary"
              disabled={isLoadingMore}
              onClick={() => void loadMore()}
            >
              {t('HOME_ACTIVITY_LOAD_MORE')}
            </Button>
          </div>
        )}
      </RequestState>
    </section>
  )
}

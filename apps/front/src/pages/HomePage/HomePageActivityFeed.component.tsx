import { RequestState } from '@/Components'
import { useTranslations } from '@/Hooks/Language'
import { HomePageActivityEntry } from './HomePageActivityEntry.component'
import type { HomePageActivityFeedProps } from './HomePageActivityFeed.types'

export function HomePageActivityFeed({
  homeQuery,
  activities,
  formatDate
}: HomePageActivityFeedProps) {
  const { t } = useTranslations()

  return (
    <section
      className="home-page__activity"
      aria-labelledby="home-activity-title"
    >
      <h2 className="home-page__activity-title" id="home-activity-title">
        {t('HOME_ACTIVITY_TITLE')}
      </h2>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && activities.length === 0}
        emptyMessage={t('HOME_ACTIVITY_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__activity-list">
          {activities.map((activity) => (
            <HomePageActivityEntry
              key={activity.id}
              activity={activity}
              formatDate={formatDate}
            />
          ))}
        </div>
      </RequestState>
    </section>
  )
}

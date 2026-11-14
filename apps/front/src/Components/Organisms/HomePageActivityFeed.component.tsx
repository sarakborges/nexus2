import { useCallback, useEffect, useRef, useState } from 'react'
import { RequestState } from '@/Components'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getRecentActivity } from '@/Services/Activity/activity.service'
import { HomePageActivityEntry } from '@/Components/Molecules/HomePageActivityEntry'
import type { HomePageActivityFeedProps } from './HomePageActivityFeed.types'

export function HomePageActivityFeed({
  homeQuery,
  activities,
  activityCursor,
  hasMoreActivities,
  formatDate
}: HomePageActivityFeedProps) {
  const { t } = useTranslations()
  const [loadedActivities, setLoadedActivities] = useState(activities)
  const [cursor, setCursor] = useState(activityCursor)
  const [hasMore, setHasMore] = useState(hasMoreActivities)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loadMore = useCallback(async () => {
    if (!cursor || !hasMore || isLoadingMore) return

    setIsLoadingMore(true)
    setLoadMoreError(false)
    try {
      const page = await getRecentActivity(cursor)
      setLoadedActivities(current => {
        const existingIds = new Set(current.map(activity => activity.id))
        return [
          ...current,
          ...page.items.filter(activity => !existingIds.has(activity.id))
        ]
      })
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch {
      setLoadMoreError(true)
    } finally {
      setIsLoadingMore(false)
    }
  }, [cursor, hasMore, isLoadingMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore || !cursor || loadMoreError) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore()
      }
    }, { rootMargin: '240px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [cursor, hasMore, loadMore, loadMoreError])

  return (
    <section className="home-page__activity" aria-labelledby="home-activity-title">
      <h2 className="home-page__activity-title" id="home-activity-title">{t('HOME_ACTIVITY_TITLE')}</h2>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && loadedActivities.length === 0}
        emptyMessage={t('HOME_ACTIVITY_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__activity-list">
          {loadedActivities.map((activity) => (
            <HomePageActivityEntry key={activity.id} activity={activity} formatDate={formatDate} />
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

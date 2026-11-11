import { useEffect, useRef, useState } from 'react'
import { RequestState } from '@/Components'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { HomePageActivityEntry } from './HomePageActivityEntry.component'
import type { HomePageActivityFeedProps } from './HomePageActivityFeed.types'

const PAGE_SIZE = 10

export function HomePageActivityFeed({ homeQuery, activities, formatDate }: HomePageActivityFeedProps) {
  const { t } = useTranslations()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const hasMore = visibleCount < activities.length

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleCount((count) => Math.min(count + PAGE_SIZE, activities.length))
      }
    }, { rootMargin: '240px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [activities.length, hasMore])

  return (
    <section className="home-page__activity" aria-labelledby="home-activity-title">
      <h2 className="home-page__activity-title" id="home-activity-title">{t('HOME_ACTIVITY_TITLE')}</h2>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && activities.length === 0}
        emptyMessage={t('HOME_ACTIVITY_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__activity-list">
          {activities.slice(0, visibleCount).map((activity) => (
            <HomePageActivityEntry key={activity.id} activity={activity} formatDate={formatDate} />
          ))}
        </div>
        {hasMore && (
          <div className="home-page__activity-more" ref={sentinelRef}>
            <Button type="button" variation="secondary" onClick={() => setVisibleCount((count) => Math.min(count + PAGE_SIZE, activities.length))}>
              {t('HOME_ACTIVITY_LOAD_MORE')}
            </Button>
          </div>
        )}
      </RequestState>
    </section>
  )
}

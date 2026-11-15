import { useCallback, useEffect, useRef, useState } from 'react'

import { getRecentActivity } from '@/Services/Activity/activity.service'
import type {
  UseHomePageActivityFeedOptions,
  UseHomePageActivityFeedResult
} from './useHomePageActivityFeed.types'

export function useHomePageActivityFeed({
  activities,
  activityCursor,
  hasMoreActivities
}: UseHomePageActivityFeedOptions): UseHomePageActivityFeedResult {
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
      if (entries.some(entry => entry.isIntersecting)) {
        void loadMore()
      }
    }, { rootMargin: '240px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [cursor, hasMore, loadMore, loadMoreError])

  return {
    loadedActivities,
    hasMore,
    isLoadingMore,
    sentinelRef,
    loadMore
  }
}

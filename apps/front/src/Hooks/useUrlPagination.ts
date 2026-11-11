import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@nexus/common'
import type { ListSort } from '@nexus/common'
import type { UseUrlPaginationResult } from './useUrlPagination.types'

import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const SORT_OPTIONS: ListSort[] = ['activity-desc', 'activity-asc', 'name-asc', 'name-desc']

export function useUrlPagination(pageKey = 'page', defaultSort: ListSort = 'activity-desc'): UseUrlPaginationResult {
  const [searchParams, setSearchParams] = useSearchParams()
  const serialized = searchParams.toString()
  const page = positiveInteger(searchParams.get(pageKey), DEFAULT_PAGE)
  const query = searchParams.get('query') ?? ''
  const requestedSort = searchParams.get('sort')
  const sort: ListSort = SORT_OPTIONS.includes(requestedSort as ListSort)
    ? requestedSort as ListSort
    : defaultSort

  useEffect(() => {
    const next = new URLSearchParams(serialized)
    let changed = false
    if (next.get(pageKey) !== String(page)) {
      next.set(pageKey, String(page))
      changed = true
    }
    if (next.has('pageSize')) {
      next.delete('pageSize')
      changed = true
    }
    if (next.has('sort') && !SORT_OPTIONS.includes(next.get('sort') as ListSort)) {
      next.delete('sort')
      changed = true
    }
    if (changed) setSearchParams(next, { replace: true })
  }, [serialized, pageKey, page, setSearchParams])

  const setPage = useCallback((nextPage: number) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      next.set(pageKey, String(Math.max(1, Math.floor(nextPage))))
      next.delete('pageSize')
      return next
    })
  }, [pageKey, setSearchParams])

  const setQuery = useCallback((nextQuery: string) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      const normalized = nextQuery.trim()
      if (normalized) next.set('query', normalized)
      else next.delete('query')
      next.set(pageKey, '1')
      if (next.has('pendingPage')) next.set('pendingPage', '1')
      next.delete('pageSize')
      return next
    })
  }, [pageKey, setSearchParams])

  const setSort = useCallback((nextSort: ListSort) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (nextSort === 'activity-desc') next.delete('sort')
      else next.set('sort', nextSort)
      next.set(pageKey, '1')
      if (next.has('pendingPage')) next.set('pendingPage', '1')
      next.delete('pageSize')
      return next
    })
  }, [pageKey, setSearchParams])

  return { page, pageSize: DEFAULT_PAGE_SIZE, setPage, query, sort, setQuery, setSort }
}

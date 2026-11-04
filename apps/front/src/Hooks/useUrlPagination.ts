import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@nexus/common'

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function useUrlPagination(pageKey = 'page') {
  const [searchParams, setSearchParams] = useSearchParams()
  const serialized = searchParams.toString()
  const page = positiveInteger(searchParams.get(pageKey), DEFAULT_PAGE)

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

  return { page, pageSize: DEFAULT_PAGE_SIZE, setPage }
}

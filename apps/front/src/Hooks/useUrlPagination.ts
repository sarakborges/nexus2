import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@nexus/common'

function positiveInteger(value: string | null, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback
}

export function useUrlPagination(pageKey = 'page') {
  const [searchParams, setSearchParams] = useSearchParams()
  const serialized = searchParams.toString()
  const page = positiveInteger(searchParams.get(pageKey), DEFAULT_PAGE)
  const pageSize = positiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  useEffect(() => {
    const next = new URLSearchParams(serialized)
    let changed = false
    if (next.get(pageKey) !== String(page)) { next.set(pageKey, String(page)); changed = true }
    if (next.get('pageSize') !== String(pageSize)) { next.set('pageSize', String(pageSize)); changed = true }
    if (changed) setSearchParams(next, { replace: true })
  }, [serialized, pageKey, page, pageSize, setSearchParams])

  const setPage = useCallback((nextPage: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set(pageKey, String(Math.max(1, Math.floor(nextPage))))
      next.set('pageSize', String(pageSize))
      return next
    })
  }, [pageKey, pageSize, setSearchParams])

  const setPageSize = useCallback((nextPageSize: number) => {
    const size = positiveInteger(String(nextPageSize), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set(pageKey, '1')
      next.set('pageSize', String(size))
      return next
    })
  }, [pageKey, setSearchParams])

  return { page, pageSize, setPage, setPageSize }
}

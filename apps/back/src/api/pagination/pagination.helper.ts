import type { PaginatedResult } from '@nexus/common'

import { FIXED_PAGE_SIZE } from './pagination.constants'
import type { PaginationDto } from './pagination.dto'

export function paginate<T>(
  items: T[],
  query: PaginationDto
): PaginatedResult<T> {
  const pageSize = FIXED_PAGE_SIZE
  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const page = Math.min(query.page, totalPages)
  const start = (page - 1) * pageSize

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages
  }
}

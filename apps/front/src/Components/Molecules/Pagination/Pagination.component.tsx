import type { PaginationProps } from './Pagination.types'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { Button } from '@/DesignSystem'
import { getTotalPages } from '@/Helpers/Math/pagination.helper'
import { useTranslations } from '@/Hooks/Language'

import './Pagination.style.scss'

export function Pagination({
  page,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange
}: PaginationProps) {
  const { t } = useTranslations()
  const totalPages = getTotalPages(totalItems, pageSize)
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label={t('PAGINATION_LABEL')}>
      <Button
        type="button"
        variation="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        {t('PAGINATION_PREVIOUS')}
      </Button>
      <span className="pagination__status">
        {t('PAGINATION_PAGE_OF', { page, totalPages })}
      </span>
      <Button
        type="button"
        variation="secondary"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('PAGINATION_NEXT')}
      </Button>
    </nav>
  )
}

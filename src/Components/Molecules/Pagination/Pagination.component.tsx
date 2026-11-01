import { Button } from '@/DesignSystem'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { getTotalPages } from '@/Helpers/Math/pagination.helper'
import { useTranslations } from '@/Hooks/Language'

type PaginationProps = {
  page: number
  totalItems: number
  onPageChange: (page: number) => void
}

export function Pagination({
  page,
  totalItems,
  onPageChange
}: PaginationProps) {
  const { t } = useTranslations()
  const totalPages = getTotalPages(totalItems, DEFAULT_PAGE_SIZE)

  if (totalPages <= 1) {
    return null
  }

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

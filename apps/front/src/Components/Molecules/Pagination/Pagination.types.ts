export type PaginationProps = {
  page: number
  totalItems: number
  pageSize?: number
  onPageChange: (page: number) => void
}

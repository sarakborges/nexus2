export const getPageItems = <T,>(
  items: T[],
  page: number,
  pageSize: number
): T[] => {
  const startIndex = Math.max(0, page - 1) * pageSize
  return items.slice(startIndex, startIndex + pageSize)
}

export const getTotalPages = (
  totalItems: number,
  pageSize: number
): number => Math.max(1, Math.ceil(totalItems / pageSize))

import type { ListSort } from '@nexus/common'

export function plainText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function filterAndSortList<T>(
  items: T[],
  query: string | undefined,
  sort: ListSort | undefined,
  getSearchText: (item: T) => string,
  getActivity: (item: T) => number,
  getName: (item: T) => string,
  getId: (item: T) => string
): T[] {
  const normalizedQuery = plainText(query).toLocaleLowerCase()
  const filtered = normalizedQuery
    ? items.filter(item => plainText(getSearchText(item)).toLocaleLowerCase().includes(normalizedQuery))
    : [...items]
  const direction = sort ?? 'activity-desc'

  return filtered.sort((left, right) => {
    const comparison = direction.startsWith('name-')
      ? getName(left).localeCompare(getName(right), undefined, { sensitivity: 'base' })
      : getActivity(left) - getActivity(right)
    return (direction.endsWith('-asc') ? comparison : -comparison) || getId(left).localeCompare(getId(right))
  })
}

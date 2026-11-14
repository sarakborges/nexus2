import type { SearchResultItem } from '@nexus/common'

import { ROUTES } from '@/Constants/routes'

export type SearchResultDetails = {
  id: string
  name: string
  picture: string
  about: string
  address: string
  href: string
  kind: 'profile' | 'community'
}

function getPlainText(value: string): string {
  return value
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

export function getSearchResultDetails(item: SearchResultItem): SearchResultDetails {
  if (item.kind === 'profile') {
    return {
      id: item.profile.id,
      name: item.profile.name,
      picture: item.profile.picture,
      about: getPlainText(item.profile.about),
      address: `/profile/${item.profile.url}`,
      href: `${ROUTES.profile}/${item.profile.url}`,
      kind: 'profile'
    }
  }

  return {
    id: item.community.id,
    name: item.community.name,
    picture: item.community.picture,
    about: getPlainText(item.community.about),
    address: `/community/${item.community.url}`,
    href: `${ROUTES.community}/${item.community.url}`,
    kind: 'community'
  }
}

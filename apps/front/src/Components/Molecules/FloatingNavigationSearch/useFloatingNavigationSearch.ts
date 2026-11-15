import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { SearchScope } from '@nexus/common'

import { ROUTES } from '@/Constants/routes'
import type { FloatingNavigationSearchDraft, UseFloatingNavigationSearchResult } from './useFloatingNavigationSearch.types'

export function useFloatingNavigationSearch(): UseFloatingNavigationSearchResult {
  const navigate = useNavigate()
  const location = useLocation()
  const routeKey = location.pathname + location.search
  const routeParams = new URLSearchParams(location.search)
  const routeQuery = location.pathname === ROUTES.search
    ? routeParams.get('query') ?? ''
    : ''
  const requestedScope = routeParams.get('scope')
  const routeScope: SearchScope =
    location.pathname === ROUTES.search &&
    (requestedScope === 'profiles' || requestedScope === 'communities')
      ? requestedScope
      : 'all'
  const [draft, setDraft] = useState<FloatingNavigationSearchDraft | null>(null)
  const searchText = draft?.routeKey === routeKey ? draft.text : routeQuery
  const searchScope = draft?.routeKey === routeKey ? draft.scope : routeScope

  return {
    searchText,
    searchScope,
    setSearchText: text => setDraft({ routeKey, text, scope: searchScope }),
    setSearchScope: scope => setDraft({ routeKey, text: searchText, scope }),
    handleSearch: event => {
      event.preventDefault()
      const query = searchText.trim()
      const params = new URLSearchParams({ scope: searchScope })
      if (query) params.set('query', query)
      navigate(ROUTES.search + '?' + params.toString())
    }
  }
}

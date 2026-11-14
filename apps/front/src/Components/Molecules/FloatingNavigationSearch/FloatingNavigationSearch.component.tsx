import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { FiSearch } from 'react-icons/fi'
import type { SearchScope } from '@nexus/common'

import { ROUTES } from '@/Constants/routes'
import { Button, Input, Select } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import './FloatingNavigationSearch.style.scss'

export function FloatingNavigationSearch() {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const routeKey = location.pathname + location.search
  const routeParams = new URLSearchParams(location.search)
  const routeQuery = location.pathname === ROUTES.search ? routeParams.get('query') ?? '' : ''
  const requestedScope = routeParams.get('scope')
  const routeScope: SearchScope =
    location.pathname === ROUTES.search &&
    (requestedScope === 'profiles' || requestedScope === 'communities')
      ? requestedScope
      : 'all'
  const [searchDraft, setSearchDraft] = useState<{
    routeKey: string
    text: string
    scope: SearchScope
  } | null>(null)
  const searchText = searchDraft?.routeKey === routeKey ? searchDraft.text : routeQuery
  const searchScope = searchDraft?.routeKey === routeKey ? searchDraft.scope : routeScope

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchText.trim()
    const params = new URLSearchParams({ scope: searchScope })
    if (query) params.set('query', query)
    navigate(`${ROUTES.search}?${params.toString()}`)
  }

  return (
    <form
      className="floating-navigation__search-form"
      role="search"
      onSubmit={handleSearch}
    >
      <Input
        type="search"
        aria-label={t('SEARCH_PLACEHOLDER')}
        placeholder={t('SEARCH_PLACEHOLDER')}
        maxLength={120}
        value={searchText}
        onChange={(event) => setSearchDraft({ routeKey, text: event.target.value, scope: searchScope })}
      />
      <Select
        aria-label={t('SEARCH_SCOPE_LABEL')}
        value={searchScope}
        onChange={(event) => setSearchDraft({ routeKey, text: searchText, scope: event.target.value as SearchScope })}
      >
        <option value="all">{t('SEARCH_SCOPE_ALL')}</option>
        <option value="profiles">{t('SEARCH_SCOPE_PROFILES')}</option>
        <option value="communities">{t('SEARCH_SCOPE_COMMUNITIES')}</option>
      </Select>
      <Button
        type="submit"
        variation="transparent"
        aria-label={t('SEARCH_SUBMIT')}
      >
        <FiSearch aria-hidden="true" />
      </Button>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { FiSearch } from 'react-icons/fi'
import type { SearchScope } from '@nexus/common'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

export function FloatingNavigationSearch() {
  const { t } = useTranslations()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchText, setSearchText] = useState(() =>
    location.pathname === ROUTES.search
      ? new URLSearchParams(location.search).get('query') ?? ''
      : ''
  )
  const [searchScope, setSearchScope] = useState<SearchScope>(() => {
    if (location.pathname !== ROUTES.search) return 'all'
    const scope = new URLSearchParams(location.search).get('scope')
    return scope === 'profiles' || scope === 'communities' ? scope : 'all'
  })

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchText.trim()
    if (!query) return
    navigate(`${ROUTES.search}?${new URLSearchParams({ query, scope: searchScope }).toString()}`)
  }

  return (
    <form
      className="floating-navigation__search-form"
      role="search"
      onSubmit={handleSearch}
    >
      <input
        type="search"
        aria-label={t('SEARCH_PLACEHOLDER')}
        placeholder={t('SEARCH_PLACEHOLDER')}
        maxLength={120}
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
      />
      <select
        aria-label={t('SEARCH_SCOPE_LABEL')}
        value={searchScope}
        onChange={(event) => setSearchScope(event.target.value as SearchScope)}
      >
        <option value="all">{t('SEARCH_SCOPE_ALL')}</option>
        <option value="profiles">{t('SEARCH_SCOPE_PROFILES')}</option>
        <option value="communities">{t('SEARCH_SCOPE_COMMUNITIES')}</option>
      </select>
      <button
        type="submit"
        aria-label={t('SEARCH_SUBMIT')}
        disabled={!searchText.trim()}
      >
        <FiSearch aria-hidden="true" />
      </button>
    </form>
  )
}

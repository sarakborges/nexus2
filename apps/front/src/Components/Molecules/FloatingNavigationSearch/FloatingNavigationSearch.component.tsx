import { FiSearch } from 'react-icons/fi'
import type { SearchScope } from '@nexus/common'

import { Button, Input, Select } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useFloatingNavigationSearch } from './useFloatingNavigationSearch'

import './FloatingNavigationSearch.style.scss'

export function FloatingNavigationSearch() {
  const { t } = useTranslations()
  const {
    searchText,
    searchScope,
    setSearchText,
    setSearchScope,
    handleSearch
  } = useFloatingNavigationSearch()

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
        onChange={event => setSearchText(event.target.value)}
      />
      <Select
        aria-label={t('SEARCH_SCOPE_LABEL')}
        value={searchScope}
        onChange={event => setSearchScope(event.target.value as SearchScope)}
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

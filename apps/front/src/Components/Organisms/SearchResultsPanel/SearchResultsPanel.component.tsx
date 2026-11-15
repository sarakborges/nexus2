import type { SearchResultItem as SearchEntityResult } from '@nexus/common'
import { Button } from '@/DesignSystem'
import { ListSortSelect } from '@/Components/Molecules/ListSortSelect'
import { Pagination } from '@/Components/Molecules/Pagination'
import { SearchResultItem } from '@/Components/Molecules/SearchResultItem'
import { useTranslations } from '@/Hooks/Language'
import { getSearchResultDetails } from './searchResult.utils'
import type { SearchResultsPanelProps } from './SearchResultsPanel.types'

import './SearchResultsPanel.style.scss'

export function SearchResultsPanel({
  query,
  isLoading,
  isError,
  isSuccess,
  results,
  totalItems,
  page,
  pageSize,
  sort,
  onSortChange,
  onPageChange,
  onRetry
}: SearchResultsPanelProps) {
  const { t } = useTranslations()

  return (
    <section className="search-results-panel">
      <header className="search-results-panel__header">
        <div>
          <h1>{t('SEARCH_TITLE')}</h1>
          {query && <p>{t('SEARCH_QUERY_LABEL', { query })}</p>}
        </div>
        {isSuccess && (
          <span className="search-results-panel__count">
            {t('SEARCH_RESULTS_COUNT', { count: totalItems })}
          </span>
        )}
      </header>

      {totalItems > 0 && (
        <ListSortSelect value={sort} onChange={onSortChange} />
      )}

      {isLoading && (
        <p className="search-results-panel__state" role="status">
          {t('SEARCH_LOADING')}
        </p>
      )}

      {isError && (
        <div className="search-results-panel__state" role="alert">
          <p>{t('SEARCH_FAILED')}</p>
          <Button type="button" variation="secondary" onClick={onRetry}>
            {t('SEARCH_RETRY')}
          </Button>
        </div>
      )}

      {isSuccess && totalItems === 0 && (
        <p className="search-results-panel__state">{t('SEARCH_NO_RESULTS')}</p>
      )}

      {results.length > 0 && (
        <div className="search-results-panel__results">
          {results.map((item: SearchEntityResult) => {
            const result = getSearchResultDetails(item)
            return (
              <SearchResultItem
                key={`${result.kind}:${result.id}`}
                name={result.name}
                picture={result.picture}
                address={result.address}
                href={result.href}
                about={result.about}
                kindLabel={t(result.kind === 'profile' ? 'SEARCH_PROFILE' : 'SEARCH_COMMUNITY')}
              />
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={onPageChange}
      />
    </section>
  )
}

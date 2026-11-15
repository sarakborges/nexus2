import { AuthenticatedPageTemplate } from '@/Components/Templates/AuthenticatedPageTemplate'
import { SearchResultsPanel } from '@/Components/Organisms/SearchResultsPanel'
import { useSearchPage } from './useSearchPage'

import './SearchPage.style.scss'

export function SearchPage() {
  const {
    query,
    searchQuery,
    results,
    totalItems,
    page,
    pageSize,
    sort,
    setPage,
    setSort
  } = useSearchPage()

  return (
    <AuthenticatedPageTemplate className="search-page">
      <SearchResultsPanel
        query={query}
        isLoading={searchQuery.isLoading}
        isError={searchQuery.isError}
        isSuccess={searchQuery.isSuccess}
        results={results}
        totalItems={totalItems}
        page={page}
        pageSize={pageSize}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        onRetry={() => void searchQuery.refetch()}
      />
    </AuthenticatedPageTemplate>
  )
}

import { SearchResultsPanel } from '@/Components/Organisms/SearchResultsPanel'
import { SocialPageLayout } from '@/Components/Templates/SocialPageLayout'
import { useSearchPage } from './useSearchPage'

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
    <SocialPageLayout className="search-page">
      <div className="social-page__content-stack">
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
      </div>
    </SocialPageLayout>
  )
}

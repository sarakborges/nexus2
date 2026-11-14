import { AuthenticatedPageTemplate } from '@/Components/Organisms/AuthenticatedPageTemplate'
import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import type { SearchScope } from '@nexus/common'
import { Button } from '@/DesignSystem'
import { IdentityAvatar, ListSortSelect, Pagination } from '@/Components'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { queryKeys } from '@/Services/Query/queryKeys'
import { searchEntities } from '@/Services/Search/search.service'
import { getSearchResultDetails } from './searchResult.utils'

import './SearchPage.style.scss'

export function SearchPage() {
  const { t } = useTranslations()
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('query') ?? '').trim()
  const requestedScope = searchParams.get('scope')
  const scope: SearchScope =
    requestedScope === 'profiles' || requestedScope === 'communities'
      ? requestedScope
      : 'all'
  const { page, pageSize, setPage, sort, setSort } = useUrlPagination()

  const searchQuery = useQuery({
    queryKey: queryKeys.search(query, scope, sort, page, pageSize),
    queryFn: () => searchEntities({ query, scope, page, pageSize, sort }),
    enabled: true
  })
  const results = searchQuery.data?.items ?? []
  const totalItems = searchQuery.data?.totalItems ?? 0

  return (
    <AuthenticatedPageTemplate className="search-page">
      <section className="search-page__content">
        <header className="search-page__header">
          <div>
            <h1>{t('SEARCH_TITLE')}</h1>
            {query && <p>{t('SEARCH_QUERY_LABEL', { query })}</p>}
          </div>
          {searchQuery.isSuccess && (
            <span className="search-page__count">
              {t('SEARCH_RESULTS_COUNT', { count: totalItems })}
            </span>
          )}
        </header>

        {totalItems > 0 && (
          <ListSortSelect value={sort} onChange={setSort} />
        )}

        {searchQuery.isLoading && (
          <p className="search-page__state" role="status">
            {t('SEARCH_LOADING')}
          </p>
        )}

        {searchQuery.isError && (
          <div className="search-page__state" role="alert">
            <p>{t('SEARCH_FAILED')}</p>
            <Button type="button" variation="secondary" onClick={() => void searchQuery.refetch()}>
              {t('SEARCH_RETRY')}
            </Button>
          </div>
        )}

        {searchQuery.isSuccess && totalItems === 0 && (
          <p className="search-page__state">{t('SEARCH_NO_RESULTS')}</p>
        )}

        {results.length > 0 && (
          <div className="search-page__results">
            {results.map(item => {
              const result = getSearchResultDetails(item)
              return (
                <article
                  className="search-result"
                  key={`${result.kind}:${result.id}`}
                >
                  <Link className="search-result__link" to={result.href}>
                    <IdentityAvatar
                      className="search-result__avatar"
                      name={result.name}
                      picture={result.picture}
                    />
                    <span className="search-result__copy">
                      <strong>{result.name}</strong>
                      <span className="search-result__address">
                        {result.address}
                      </span>
                      {result.about && (
                        <span className="search-result__about">
                          {result.about}
                        </span>
                      )}
                    </span>
                    <span className="search-result__kind">
                      {t(result.kind === 'profile' ? 'SEARCH_PROFILE' : 'SEARCH_COMMUNITY')}
                    </span>
                  </Link>
                </article>
              )
            })}
          </div>
        )}

        <Pagination
          page={searchQuery.data?.page ?? page}
          pageSize={searchQuery.data?.pageSize ?? pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
        />
      </section>
    </AuthenticatedPageTemplate>
  )
}

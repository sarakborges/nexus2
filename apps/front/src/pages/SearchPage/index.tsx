import { Link, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'

import type { SearchResultItem, SearchScope } from '@nexus/common'
import { IdentityAvatar, Pagination } from '@/Components'
import { PaginatedListControls } from '@/Components/Organisms/PaginatedListControls.component'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { queryKeys } from '@/Services/Query/queryKeys'
import { searchEntities } from '@/Services/Search/search.service'

import './SearchPage.style.scss'

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

function resultDetails(item: SearchResultItem) {
  if (item.kind === 'profile') {
    return {
      id: item.profile.id,
      name: item.profile.name,
      picture: item.profile.picture,
      about: getPlainText(item.profile.about),
      address: `/profile/${item.profile.url}`,
      href: `${ROUTES.profile}/${item.profile.url}`,
      kind: 'profile' as const
    }
  }

  return {
    id: item.community.id,
    name: item.community.name,
    picture: item.community.picture,
    about: getPlainText(item.community.about),
    address: `/community/${item.community.url}`,
    href: `${ROUTES.community}/${item.community.url}`,
    kind: 'community' as const
  }
}

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
    enabled: Boolean(query)
  })
  const results = searchQuery.data?.items ?? []
  const totalItems = searchQuery.data?.totalItems ?? 0

  return (
    <main className="search-page">
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

        <PaginatedListControls query={query} sort={sort} onQueryChange={() => undefined} onSortChange={setSort} showQuery={false} />

        {!query && (
          <p className="search-page__state">{t('SEARCH_EMPTY_QUERY')}</p>
        )}

        {searchQuery.isLoading && (
          <p className="search-page__state" role="status">
            {t('SEARCH_LOADING')}
          </p>
        )}

        {searchQuery.isError && (
          <div className="search-page__state" role="alert">
            <p>{t('SEARCH_FAILED')}</p>
            <button type="button" onClick={() => void searchQuery.refetch()}>
              {t('SEARCH_RETRY')}
            </button>
          </div>
        )}

        {searchQuery.isSuccess && totalItems === 0 && (
          <p className="search-page__state">{t('SEARCH_NO_RESULTS')}</p>
        )}

        {results.length > 0 && (
          <div className="search-page__results">
            {results.map(item => {
              const result = resultDetails(item)
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

        {query && (
          <Pagination
            page={searchQuery.data?.page ?? page}
            pageSize={searchQuery.data?.pageSize ?? pageSize}
            totalItems={totalItems}
            onPageChange={setPage}
          />
        )}
      </section>
    </main>
  )
}

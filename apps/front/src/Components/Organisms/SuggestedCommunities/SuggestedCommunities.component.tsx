import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { RequestState } from '@/Components/Molecules/RequestState/RequestState.component'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'

export function SuggestedCommunities() {
  const { t } = useTranslations()
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(1, 5),
    queryFn: () => getCommunities({ page: 1, pageSize: 5 }),
    staleTime: 5 * 60 * 1000
  })
  const communities = communitiesQuery.data?.items ?? []

  return (
    <section className="social-preview-panel social-suggestions">
      <header className="social-preview-panel__header">
        <h2>{t('COMMUNITY_SUGGESTED_TITLE')}</h2>
      </header>
      <RequestState
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        isEmpty={communitiesQuery.isSuccess && communities.length === 0}
        emptyMessage={t('COMMUNITIES_EMPTY')}
        onRetry={() => void communitiesQuery.refetch()}
      >
        <div className="social-suggestions__list">
          {communities.map(community => (
            <Link className="social-suggestions__item" key={community.id} to={`${ROUTES.community}/${community.url}`}>
              <span className="social-suggestions__avatar">
                {community.picture
                  ? <img src={community.picture} alt="" />
                  : <span aria-hidden="true">{community.name.trim().charAt(0).toUpperCase()}</span>}
              </span>
              <span className="social-suggestions__name">{community.name}</span>
            </Link>
          ))}
        </div>
      </RequestState>
      <Link className="social-preview-panel__all" to={ROUTES.communities}>{t('COMMUNITIES_TITLE')}</Link>
    </section>
  )
}

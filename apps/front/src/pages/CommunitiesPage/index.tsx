import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { ButtonLink } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const { page, pageSize, setPage } = useUrlPagination()
  const communitiesQuery = useQuery({
    queryKey: queryKeys.communities.list(page, pageSize),
    queryFn: () => getCommunities({ page, pageSize })
  })
  const communities = communitiesQuery.data?.items ?? []
  const totalItems = communitiesQuery.data?.totalItems ?? 0

  useEffect(() => {
    if (communitiesQuery.data && communitiesQuery.data.page !== page) setPage(communitiesQuery.data.page)
  }, [communitiesQuery.data, page, setPage])

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('COMMUNITIES_TITLE')}</h1>
          <ButtonLink className="account-card__action" variation="primary" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</ButtonLink>
        </header>
        <RequestState
          isLoading={communitiesQuery.isLoading}
          isFetching={communitiesQuery.isFetching}
          isError={communitiesQuery.isError}
          isEmpty={communitiesQuery.isSuccess && totalItems === 0}
          emptyMessage={t('COMMUNITIES_EMPTY')}
          onRetry={() => void communitiesQuery.refetch()}
        >
          <div className="account-card__profile-list">
            {communities.map(community => (
              <div className="account-card__profile-entry" key={community.id}>
                <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{community.name} · /community/{community.url}</Link>
              </div>
            ))}
          </div>
        </RequestState>
        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
        <Link className="account-card__link" to={ROUTES.home}>{t('PROFILE_BACK_HOME')}</Link>
      </section>
    </main>
  )
}

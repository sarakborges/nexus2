import { ButtonLink } from '@/DesignSystem'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageCommunitiesPreviewProps } from './HomePageCommunitiesPreview.types'

export function HomePageCommunitiesPreview({
  profileUrl,
  homeQuery
}: HomePageCommunitiesPreviewProps) {
  const { t } = useTranslations()
  const communities = homeQuery.data?.communities.items ?? []

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {t('PROFILE_COMMUNITIES_TITLE')}
          <span className="social-preview-panel__count">
            ({homeQuery.data?.communities.totalItems ?? '—'})
          </span>
        </h2>
        <ButtonLink
          variation="transparent"
          className="social-preview-panel__all"
          to={ROUTES.profile + '/' + profileUrl + '/communities'}
        >
          {t('COMMON_VIEW_ALL')}
        </ButtonLink>
      </header>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && communities.length === 0}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__preview-list">
          {communities.map((community) => (
            <HomePagePreviewEntry
              key={community.id}
              name={community.name}
              picture={community.picture}
              href={ROUTES.community + '/' + community.url}
              secondary={'/community/' + community.url}
            />
          ))}
        </div>
      </RequestState>
    </section>
  )
}

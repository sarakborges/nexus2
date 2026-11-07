import { Link } from 'react-router'

import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageCommunitiesPreviewProps } from './HomePageCommunitiesPreview.types'

export function HomePageCommunitiesPreview({
  profileUrl,
  communitiesQuery,
  communities
}: HomePageCommunitiesPreviewProps) {
  const { t } = useTranslations()

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>
          {t('PROFILE_COMMUNITIES_TITLE')}
          <span className="social-preview-panel__count">
            ({communitiesQuery.data?.totalItems ?? '—'})
          </span>
        </h2>
        <Link
          className="social-preview-panel__all"
          to={ROUTES.profile + '/' + profileUrl + '/communities'}
        >
          {t('PROFILE_COMMUNITIES_LINK')}
        </Link>
      </header>
      <RequestState
        isLoading={communitiesQuery.isLoading}
        isFetching={communitiesQuery.isFetching}
        isError={communitiesQuery.isError}
        isEmpty={communitiesQuery.isSuccess && communities.length === 0}
        emptyMessage={t('PROFILE_COMMUNITIES_EMPTY')}
        onRetry={() => void communitiesQuery.refetch()}
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

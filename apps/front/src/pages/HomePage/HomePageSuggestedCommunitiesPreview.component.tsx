import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageSuggestedCommunitiesPreviewProps } from './HomePageSuggestedCommunitiesPreview.types'

export function HomePageSuggestedCommunitiesPreview({
  homeQuery
}: HomePageSuggestedCommunitiesPreviewProps) {
  const { t } = useTranslations()
  const suggestions = homeQuery.data?.suggestions ?? []

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>{t('HOME_SUGGESTED_COMMUNITIES')}</h2>
      </header>
      <RequestState
        isLoading={homeQuery.isLoading}
        isFetching={homeQuery.isFetching}
        isError={homeQuery.isError}
        isEmpty={homeQuery.isSuccess && suggestions.length === 0}
        emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
        onRetry={() => void homeQuery.refetch()}
      >
        <div className="home-page__preview-list">
          {suggestions.map((community) => (
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

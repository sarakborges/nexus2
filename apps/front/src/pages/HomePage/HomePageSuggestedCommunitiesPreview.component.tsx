import { RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { HomePagePreviewEntry } from './HomePagePreviewEntry.component'
import type { HomePageSuggestedCommunitiesPreviewProps } from './HomePageSuggestedCommunitiesPreview.types'

export function HomePageSuggestedCommunitiesPreview({
  allCommunitiesQuery,
  ownedCommunityIdsQuery,
  suggestions
}: HomePageSuggestedCommunitiesPreviewProps) {
  const { t } = useTranslations()

  return (
    <section className="social-preview-panel">
      <header className="social-preview-panel__header">
        <h2>{t('HOME_SUGGESTED_COMMUNITIES')}</h2>
      </header>
      <RequestState
        isLoading={
          allCommunitiesQuery.isLoading || ownedCommunityIdsQuery.isLoading
        }
        isFetching={
          allCommunitiesQuery.isFetching || ownedCommunityIdsQuery.isFetching
        }
        isError={
          allCommunitiesQuery.isError || ownedCommunityIdsQuery.isError
        }
        isEmpty={
          allCommunitiesQuery.isSuccess &&
          ownedCommunityIdsQuery.isSuccess &&
          suggestions.length === 0
        }
        emptyMessage={t('HOME_SUGGESTED_COMMUNITIES_EMPTY')}
        onRetry={() => {
          void allCommunitiesQuery.refetch()
          void ownedCommunityIdsQuery.refetch()
        }}
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

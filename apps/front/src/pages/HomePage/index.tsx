import { AuthenticatedPageState } from '@/Components/Organisms/AuthenticatedPageState'
import { SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { formatHomeActivityDate } from './formatHomeActivityDate'
import { useHomePage } from './useHomePage'
import { HomePageActivityFeed } from './HomePageActivityFeed.component'
import { HomePagePostComposer } from './HomePagePostComposer.component'
import { HomePageRightSidebar } from './HomePageRightSidebar.component'

import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const { homeQuery } = useHomePage()
  const me = homeQuery.data
  const currentProfile = me?.currentProfile ?? null

  if (!currentProfile) {
    return (
      <AuthenticatedPageState
        isLoading={homeQuery.isLoading}
        isError={homeQuery.isError}
        onRetry={() => void homeQuery.refetch()}
      />
    )
  }

  return (
    <SocialPageLayout
      className="home-page"
      rightSidebar={
        <HomePageRightSidebar
          currentProfile={currentProfile}
          suggestedCommunities={me?.suggestedCommunities ?? []}
        />
      }
    >
      <section className="home-page__content">
        <header className="home-page__header">
          <h1 className="social-panel__title">{t('HOME_TITLE')}</h1>
        </header>
        <HomePagePostComposer currentProfile={currentProfile} />
        <HomePageActivityFeed
          key={currentProfile.id + ':' + homeQuery.dataUpdatedAt}
          homeQuery={homeQuery}
          activities={me?.activities ?? []}
          activityCursor={me?.activityCursor ?? null}
          hasMoreActivities={me?.hasMoreActivities ?? false}
          formatDate={formatHomeActivityDate}
        />
      </section>
    </SocialPageLayout>
  )
}

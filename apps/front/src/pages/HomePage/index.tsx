import { RequestState } from '@/Components'
import { SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { formatHomeActivityDate } from './formatHomeActivityDate'
import { useHomePage } from './useHomePage'
import { HomePageActivityFeed } from './HomePageActivityFeed.component'
import { HomePagePostComposer } from './HomePagePostComposer.component'

import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const { homeQuery } = useHomePage()
  const home = homeQuery.data
  const currentProfile = home?.currentProfile ?? null

  if (!currentProfile) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading={homeQuery.isLoading} isError={homeQuery.isError} onRetry={() => void homeQuery.refetch()} />
        </section>
      </main>
    )
  }

  return (
    <SocialPageLayout className="home-page">
      <section className="home-page__content">
        <header className="home-page__header">
          <h1 className="social-panel__title">{t('HOME_TITLE')}</h1>
        </header>
        <HomePagePostComposer currentProfile={currentProfile} />
        <HomePageActivityFeed
          homeQuery={homeQuery}
          activities={home?.activities ?? []}
          activityCursor={home?.activityCursor ?? null}
          hasMoreActivities={home?.hasMoreActivities ?? false}
          formatDate={formatHomeActivityDate}
        />
      </section>
    </SocialPageLayout>
  )
}

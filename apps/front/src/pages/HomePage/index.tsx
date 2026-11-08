import { RequestState } from '@/Components'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { formatHomeActivityDate } from './formatHomeActivityDate'
import { useHomePage } from './useHomePage'
import { HomePageActivityFeed } from './HomePageActivityFeed.component'
import { HomePageRightSidebar } from './HomePageRightSidebar.component'

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
          <RequestState
            isLoading={homeQuery.isLoading}
            isError={homeQuery.isError}
            onRetry={() => void homeQuery.refetch()}
          />
        </section>
      </main>
    )
  }

  return (
    <SocialPageLayout
      className="home-page"
      sidebar={
        <ProfileSidebar
          profile={currentProfile}
          active="home"
          showRelationshipActions={false}
        />
      }
      rightSidebar={
        <HomePageRightSidebar
          currentProfile={currentProfile}
          homeQuery={homeQuery}
        />
      }
    >
      <section className="social-panel home-page__card">
        <header className="social-panel__header">
          <div>
            <h1 className="social-panel__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">
              {t('HOME_ACTIVITY_DESCRIPTION')}
            </p>
          </div>
        </header>
        <HomePageActivityFeed
          homeQuery={homeQuery}
          activities={home.activities}
          formatDate={formatHomeActivityDate}
        />
      </section>
    </SocialPageLayout>
  )
}

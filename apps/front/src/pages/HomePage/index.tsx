import { RequestState } from '@/Components'
import {
  ProfileSidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { useHomePage } from './useHomePage'
import { HomePageActivityFeed } from './HomePageActivityFeed.component'
import { HomePageRightSidebar } from './HomePageRightSidebar.component'

import './HomePage.style.scss'

export function HomePage() {
  const { t } = useTranslations()
  const {
    activityQuery,
    profilesQuery,
    friendsQuery,
    communitiesQuery,
    allCommunitiesQuery,
    ownedCommunityIdsQuery,
    currentProfile,
    activities,
    friends,
    communities,
    suggestions,
    formatDate
  } = useHomePage()

  if (!currentProfile) {
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isLoading={profilesQuery.isLoading}
            isError={profilesQuery.isError}
            onRetry={() => void profilesQuery.refetch()}
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
          friendsQuery={friendsQuery}
          communitiesQuery={communitiesQuery}
          allCommunitiesQuery={allCommunitiesQuery}
          ownedCommunityIdsQuery={ownedCommunityIdsQuery}
          friends={friends}
          communities={communities}
          suggestions={suggestions}
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
          activityQuery={activityQuery}
          activities={activities}
          formatDate={formatDate}
        />
      </section>
    </SocialPageLayout>
  )
}

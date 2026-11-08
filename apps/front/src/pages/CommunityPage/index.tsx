import { RequestState } from '@/Components'
import { CommunitySidebar } from '@/Components/Organisms/SocialPageLayout'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { CommunityPageAboutPreview } from './CommunityPageAboutPreview.component'
import { CommunityPageForumPreview } from './CommunityPageForumPreview.component'
import { CommunityPageMembersPreview } from './CommunityPageMembersPreview.component'
import { useCommunityPage } from './useCommunityPage'

import '../AuthenticatedPage.style.scss'
import './CommunityPage.style.scss'

export function CommunityPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    communityPageQuery,
    community,
    typeCompatibility,
    canInteract,
    canViewMembers,
    canEditCommunity,
    openEditCommunity,
    pendingRequestCount,
    members,
    memberCount,
    forumTopics,
    forumAuthorsById
  } = useCommunityPage()

  if (!requestedUrl) return <NotFoundPage />
  if (communityPageQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (communityPageQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState
            isError
            onRetry={() => void communityPageQuery.refetch()}
          />
        </div>
      </main>
    )
  }
  if (!community) return <NotFoundPage />

  return (
    <main className="social-page social-page--community">
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <CommunitySidebar
            community={community}
            active="about"
            canInteract={canInteract}
          />
        </aside>

        <section className="social-page__main-column">
          <RequestState isFetching={communityPageQuery.isFetching} />
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
            <p className="profile-type-notice" role="alert">
              {t('PROFILE_TYPE_MISMATCH_NOTICE')}
            </p>
          )}
          <CommunityPageAboutPreview
            community={community}
            canViewMembers={canViewMembers}
            canEditCommunity={canEditCommunity}
            pendingRequestCount={pendingRequestCount}
            onEdit={openEditCommunity}
          />

          <CommunityPageForumPreview
            communityUrl={community.url}
            communityPageQuery={communityPageQuery}
            canViewMembers={canViewMembers}
            topics={forumTopics}
            authorsById={forumAuthorsById}
          />
        </section>

        <aside className="social-page__right-column">
          <CommunityPageMembersPreview
            communityUrl={community.url}
            communityPageQuery={communityPageQuery}
            canViewMembers={canViewMembers}
            members={members}
            memberCount={memberCount}
          />
        </aside>
      </div>
    </main>
  )
}

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
    communityQuery,
    community,
    typeCompatibility,
    canInteract,
    relationshipsQuery,
    canViewMembers,
    canEditCommunity,
    openEditCommunity,
    members,
    memberCount,
    pendingActor,
    pendingRequestsQuery,
    membersQuery,
    forumTopicsQuery,
    forumTopics,
    forumAuthorsQuery,
    forumAuthorsById
  } = useCommunityPage()

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (communityQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </div>
      </main>
    )
  }
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState isLoading />
        </div>
      </main>
    )
  }
  if (relationshipsQuery.isError) {
    return (
      <main className="social-page">
        <div className="social-page__state">
          <RequestState
            isError
            onRetry={() => void relationshipsQuery.refetch()}
          />
        </div>
      </main>
    )
  }

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
          <RequestState
            isFetching={
              communityQuery.isFetching || relationshipsQuery.isFetching
            }
          />
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
            <p className="profile-type-notice" role="alert">
              {t('PROFILE_TYPE_MISMATCH_NOTICE')}
            </p>
          )}
          <CommunityPageAboutPreview
            community={community}
            canViewMembers={canViewMembers}
            canEditCommunity={canEditCommunity}
            pendingRequestCount={
              pendingActor ? (pendingRequestsQuery.data?.totalItems ?? 0) : 0
            }
            onEdit={openEditCommunity}
          />

          <CommunityPageForumPreview
            communityUrl={community.url}
            topicsQuery={forumTopicsQuery}
            authorsQuery={forumAuthorsQuery}
            topics={forumTopics}
            authorsById={forumAuthorsById}
          />
        </section>

        <aside className="social-page__right-column">
          <CommunityPageMembersPreview
            communityUrl={community.url}
            canViewMembers={canViewMembers}
            membersQuery={membersQuery}
            members={members}
            memberCount={memberCount}
          />
        </aside>
      </div>
    </main>
  )
}

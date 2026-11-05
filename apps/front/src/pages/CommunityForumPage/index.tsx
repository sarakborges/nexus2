import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCommunityForumPage } from './useCommunityForumPage'

import '../AuthenticatedPage.style.scss'
import './CommunityForumPage.style.scss'

export function CommunityForumPage() {
  const { t } = useTranslations()
  const {
    normalized,
    session,
    page,
    pageSize,
    setPage,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    ownedProfilesQuery,
    canPublish,
    openCreateTopic,
    topicsQuery,
    topics,
    authorsQuery,
    authorsById
  } = useCommunityForumPage()

  if (!normalized) return <NotFoundPage />
  if (communityQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (communityQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </section>
      </main>
    )
  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="forum"
          canInteract={
            !session ||
            (typeCompatibility.isCompatible && !typeCompatibility.isChecking)
          }
        />
      }
    >
      <section className="community-forum social-page__content-stack">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_TITLE')}</h1>
            <p className="account-card__description">
              {t('FORUM_DESCRIPTION')}
            </p>
          </div>
          {canPublish && (
            <Button
              type="button"
              onClick={openCreateTopic}
            >
              {t('FORUM_NEW_TOPIC')}
            </Button>
          )}
        </header>

        <RequestState
          isLoading={
            relationshipsQuery.isLoading || ownedProfilesQuery.isLoading
          }
          isError={relationshipsQuery.isError || ownedProfilesQuery.isError}
          onRetry={() => {
            void relationshipsQuery.refetch()
            void ownedProfilesQuery.refetch()
          }}
        />
        {!canPublish &&
          session &&
          relationshipsQuery.isSuccess &&
          ownedProfilesQuery.isSuccess && (
            <div className="community-forum__join">
              <p className="account-card__description">
                {t('FORUM_MEMBERS_ONLY')}
              </p>
              <RelationshipActions
                targetId={community.id}
                targetKind="community"
              />
            </div>
          )}

        <RequestState
          isLoading={topicsQuery.isLoading || authorsQuery.isLoading}
          isFetching={topicsQuery.isFetching || authorsQuery.isFetching}
          isError={topicsQuery.isError || authorsQuery.isError}
          isEmpty={topicsQuery.isSuccess && topicsQuery.data.totalItems === 0}
          emptyMessage={t('FORUM_EMPTY')}
          onRetry={() => {
            void topicsQuery.refetch()
            void authorsQuery.refetch()
          }}
        >
          <CommunityForumTopicList
            communityUrl={community.url}
            topics={topics}
            authorsById={authorsById}
          />
        </RequestState>
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={topicsQuery.data?.totalItems ?? 0}
          onPageChange={setPage}
        />
      </section>
    </SocialPageLayout>
  )
}

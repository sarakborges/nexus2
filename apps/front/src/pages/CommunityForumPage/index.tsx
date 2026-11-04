import { useQuery } from '@tanstack/react-query'

import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { CommunityForumTopicList } from '@/Components/Organisms/CommunityForumTopicList/CommunityForumTopicList.component'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityForumTopics } from '@/Services/CommunityForum'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'
import './CommunityForumPage.style.scss'

export function CommunityForumPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const session = useAuthStore((state) => state.session)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const { page, pageSize, setPage } = useUrlPagination()

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized, session?.user.id ?? null),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    community?.type ?? 'social'
  )
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(
      community?.id ?? '',
      session?.user.id ?? null
    ),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id && session?.user.id)
  })
  const ownedProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const rolesByProfileId = new Map(
    (relationshipsQuery.data ?? [])
      .filter((record) => record.profiles[1] === community?.id)
      .map((record) => [record.profiles[0], record.type] as const)
  )
  const eligibleProfiles = (ownedProfilesQuery.data ?? []).filter(
    (profile) =>
      profile.type === community?.type &&
      ['owner', 'moderator', 'connection'].includes(
        rolesByProfileId.get(profile.id) ?? ''
      )
  )
  const forumProfile =
    eligibleProfiles.find((profile) => profile.id === currentProfileId) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'owner'
    ) ??
    eligibleProfiles.find(
      (profile) => rolesByProfileId.get(profile.id) === 'moderator'
    ) ??
    eligibleProfiles[0] ??
    null
  const canPublish = Boolean(forumProfile)

  const topicsQuery = useQuery({
    queryKey: queryKeys.communityForumTopics(
      community?.id ?? '',
      page,
      pageSize,
      session?.user.id ?? null
    ),
    queryFn: () => getCommunityForumTopics(community!.id, { page, pageSize }),
    enabled: Boolean(community?.id)
  })
  const topics = useMemo(
    () => topicsQuery.data?.items ?? [],
    [topicsQuery.data?.items]
  )
  const authorIds = useMemo(
    () => [...new Set(topics.map((topic) => topic.profileId))].sort(),
    [topics]
  )
  const authorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(authorIds),
    queryFn: () => getProfilesByIds(authorIds),
    enabled: authorIds.length > 0
  })
  const authorsById = useMemo(
    () =>
      new Map(
        (authorsQuery.data ?? []).map(
          (profile) => [profile.id, profile] as const
        )
      ),
    [authorsQuery.data]
  )

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
              onClick={() =>
                navigate(ROUTES.community + '/' + community.url + '/forum/new')
              }
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

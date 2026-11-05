import { Link } from 'react-router'

import { CommunityMemberActions, Pagination, RequestState } from '@/Components'
import {
  CommunitySidebar,
  SocialPageLayout
} from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useCommunityMembersPage } from './useCommunityMembersPage'

import '../AuthenticatedPage.style.scss'
import './CommunityMembersPage.style.scss'

import type { Member, MemberTab } from './CommunityMembersPage.types'

export function CommunityMembersPage() {
  const { t } = useTranslations()
  const {
    url,
    normalized,
    activeTab,
    setActiveTab,
    page,
    pageSize,
    setPage,
    pendingPage,
    pendingPageSize,
    setPendingPage,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    relationships,
    actorProfileId,
    currentRole,
    isStaff,
    visibleTab,
    membersQuery,
    pendingQuery,
    members,
    totalMembers,
    pending,
    totalPending
  } = useCommunityMembersPage()
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
  if (relationshipsQuery.isLoading)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (relationshipsQuery.isError)
    return (
      <main className="account-page">
        <section className="account-card">
          <RequestState
            isError
            onRetry={() => void relationshipsQuery.refetch()}
          />
        </section>
      </main>
    )

  const renderMember = (profile: Member) => {
    const roleKey =
      profile.role === 'owner'
        ? 'COMMUNITY_ROLE_OWNER'
        : profile.role === 'moderator'
          ? 'COMMUNITY_ROLE_MODERATOR'
          : profile.role === 'connection'
            ? 'COMMUNITY_ROLE_MEMBER'
            : null
    const relationship =
      relationships.find(
        (record) =>
          record.profiles[0] === profile.id &&
          record.profiles[1] === community.id
      ) ?? null
    return (
      <article className="account-card__profile-entry" key={profile.id}>
        <Link
          className="account-card__profile-entry-identity"
          to={ROUTES.profile + '/' + profile.url}
        >
          <span className="account-card__profile-entry-avatar">
            {profile.picture ? (
              <img src={profile.picture} alt="" />
            ) : (
              <span aria-hidden="true">
                {profile.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className="account-card__profile-entry-copy">
            <span className="account-card__link">{profile.name}</span>
            <span className="account-card__profile-entry-secondary">
              @{profile.url}
            </span>
            {roleKey && (
              <span className="community-member__role">{t(roleKey)}</span>
            )}
          </span>
        </Link>
        {isStaff && actorProfileId && profile.role !== 'owner' && (
          <CommunityMemberActions
            memberProfileId={profile.id}
            communityId={community.id}
            actorProfileId={actorProfileId}
            actorRole={currentRole as 'owner' | 'moderator'}
            relationship={relationship}
          />
        )}
      </article>
    )
  }

  const tabs: Array<{ id: MemberTab; label: string }> = [
    { id: 'all', label: t('COMMUNITY_TAB_ALL') },
    ...(isStaff
      ? [
          { id: 'staff' as const, label: t('COMMUNITY_TAB_STAFF') },
          { id: 'banned' as const, label: t('COMMUNITY_TAB_BANNED') }
        ]
      : [])
  ]

  return (
    <SocialPageLayout
      sidebar={
        <CommunitySidebar
          community={community}
          active="members"
          canInteract={
            typeCompatibility.isCompatible && !typeCompatibility.isChecking
          }
        />
      }
    >
      <div className="community-members-page">
        {isStaff && (
          <section className="account-card community-members-page__pending">
            <header className="account-card__header">
              <div>
                <h1 className="account-card__title">
                  {t('COMMUNITY_PENDING_REQUESTS')}
                </h1>
                <p className="account-card__description">
                  {t('COMMUNITY_PENDING_COUNT', { count: totalPending })}
                </p>
              </div>
            </header>
            <RequestState
              isLoading={pendingQuery.isLoading}
              isFetching={pendingQuery.isFetching}
              isError={pendingQuery.isError}
              isEmpty={pendingQuery.isSuccess && totalPending === 0}
              emptyMessage={t('COMMUNITY_MEMBERS_PENDING_EMPTY')}
              onRetry={() => void pendingQuery.refetch()}
            >
              <div className="account-card__profile-list account-card__profile-list--grid">
                {pending.map(renderMember)}
              </div>
            </RequestState>
            {totalPending > pendingPageSize && (
              <Pagination
                page={pendingPage}
                pageSize={pendingPageSize}
                totalItems={totalPending}
                onPageChange={setPendingPage}
              />
            )}
          </section>
        )}

        <section className="account-card">
          <header className="account-card__header">
            <div>
              <h1 className="account-card__title">
                {t('COMMUNITY_MEMBERS_TITLE')}
              </h1>
              <p className="account-card__description">
                {t('COMMUNITY_MEMBERS_DESCRIPTION')}
              </p>
            </div>
          </header>
          {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
            <p className="profile-type-notice" role="alert">
              {t('PROFILE_TYPE_MISMATCH_NOTICE')}
            </p>
          )}
          <div className="community-member__tabs" role="tablist">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={visibleTab === tab.id}
                variation={activeTab === tab.id ? 'primary' : 'secondary'}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <RequestState
            isLoading={membersQuery.isLoading}
            isFetching={membersQuery.isFetching}
            isError={membersQuery.isError}
            isEmpty={membersQuery.isSuccess && totalMembers === 0}
            emptyMessage={t(
              visibleTab === 'all'
                ? 'COMMUNITY_MEMBERS_EMPTY'
                : visibleTab === 'staff'
                  ? 'COMMUNITY_STAFF_EMPTY'
                  : 'COMMUNITY_BANNED_EMPTY'
            )}
            onRetry={() => void membersQuery.refetch()}
          >
            <div className="account-card__profile-list account-card__profile-list--grid">
              {members.map(renderMember)}
            </div>
          </RequestState>
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={totalMembers}
            onPageChange={setPage}
          />
        </section>
      </div>
    </SocialPageLayout>
  )
}

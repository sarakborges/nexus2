import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import type { CommunityRelationship, Profile } from '@nexus/common'
import { CommunityMemberActions, Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityMembers, getCommunityRelationships, getPendingCommunityMembers } from '@/Services/CommunityRelationship'
import { getCommunityByUrl } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

type MemberTab = 'all' | 'staff' | 'banned'
type Member = Profile & { role: string }

export function CommunityMembersPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const { page, pageSize, setPage } = useUrlPagination('page')
  const { page: pendingPage, pageSize: pendingPageSize, setPage: setPendingPage } = useUrlPagination('pendingPage')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(community?.type ?? 'social')
  const canInteract = typeCompatibility.isCompatible && !typeCompatibility.isChecking
  const communityId = community?.id
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(communityId ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(communityId!),
    enabled: Boolean(communityId)
  })
  const relationships: CommunityRelationship[] = relationshipsQuery.data ?? []
  const currentRole = communityId && currentProfileId
    ? relationships.find(record => record.profiles[0] === currentProfileId && record.profiles[1] === communityId)?.type ?? null
    : null
  const isStaff = currentRole === 'owner' || currentRole === 'moderator'
  const visibleTab: MemberTab = isStaff ? activeTab : 'all'
  const membersQuery = useQuery({
    queryKey: queryKeys.communityMembers(communityId ?? '', visibleTab, page, pageSize, currentProfileId ?? undefined),
    queryFn: () => getCommunityMembers(communityId!, visibleTab, { page, pageSize }, currentProfileId ?? undefined),
    enabled: Boolean(communityId && relationshipsQuery.isSuccess)
  })
  const pendingQuery = useQuery({
    queryKey: queryKeys.pendingCommunityMembers(communityId ?? '', currentProfileId ?? '', pendingPage, pendingPageSize),
    queryFn: () => getPendingCommunityMembers(communityId!, currentProfileId!, { page: pendingPage, pageSize: pendingPageSize }),
    enabled: Boolean(communityId && currentProfileId && isStaff && relationshipsQuery.isSuccess && canInteract)
  })
  const members: Member[] = membersQuery.data?.items ?? []
  const totalMembers = membersQuery.data?.totalItems ?? 0
  const pending: Member[] = pendingQuery.data?.items ?? []
  const totalPending = pendingQuery.data?.totalItems ?? 0
  const canViewPending = Boolean(communityId && currentProfileId && isStaff)

  useEffect(() => {
    if (membersQuery.data && membersQuery.data.page !== page) setPage(membersQuery.data.page)
  }, [membersQuery.data, page, setPage])
  useEffect(() => {
    if (pendingQuery.data && pendingQuery.data.page !== pendingPage) setPendingPage(pendingQuery.data.page)
  }, [pendingQuery.data, pendingPage, setPendingPage])

  if (!normalized) return <NotFoundPage />
  if (communityQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (communityQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (relationshipsQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void relationshipsQuery.refetch()} /></section></main>

  const renderMember = (profile: Member) => {
    const roleKey = profile.role === 'owner' ? 'COMMUNITY_ROLE_OWNER' : profile.role === 'moderator' ? 'COMMUNITY_ROLE_MODERATOR' : profile.role === 'connection' ? 'COMMUNITY_ROLE_MEMBER' : null
    const relationship = relationships.find(record => record.profiles[0] === profile.id && record.profiles[1] === community.id) ?? null
    return (
      <div className="account-card__profile-entry" key={profile.id}>
        <div className="community-member__identity">
          <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{profile.name}</Link>
          {roleKey && <span className="community-member__role">{t(roleKey)}</span>}
        </div>
        {isStaff && canInteract && currentProfileId && profile.role !== 'owner' && (
          <CommunityMemberActions memberProfileId={profile.id} communityId={community.id} actorProfileId={currentProfileId} actorRole={currentRole as 'owner' | 'moderator'} relationship={relationship} />
        )}
      </div>
    )
  }

  const tabs: Array<{ id: MemberTab; label: string }> = [
    { id: 'all', label: t('COMMUNITY_TAB_ALL') },
    ...(isStaff ? [
      { id: 'staff' as const, label: t('COMMUNITY_TAB_STAFF') },
      { id: 'banned' as const, label: t('COMMUNITY_TAB_BANNED') }
    ] : [])
  ]

  return (
    <main className="account-page"><RequestState isFetching={communityQuery.isFetching || relationshipsQuery.isFetching} />{!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}<section className="account-card">
      <header className="account-card__header">
        <div><h1 className="account-card__title">{t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}</h1><p className="account-card__description">{t('COMMUNITY_MEMBERS_DESCRIPTION')}</p></div>
        <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
      </header>
      {canViewPending && (
        <section className="account-card__profile-list">
          <h2>{t('COMMUNITY_PENDING_REQUESTS')}</h2>
          <RequestState
            isLoading={pendingQuery.isLoading}
            isFetching={pendingQuery.isFetching}
            isError={pendingQuery.isError}
            isEmpty={pendingQuery.isSuccess && totalPending === 0}
            emptyMessage={t('COMMUNITY_PENDING_EMPTY')}
            onRetry={() => void pendingQuery.refetch()}
          >
            {pending.map(renderMember)}
          </RequestState>
          <Pagination page={pendingPage} pageSize={pendingPageSize} totalItems={totalPending} onPageChange={setPendingPage} />
        </section>
      )}
      <div className="community-member__tabs" role="tablist">
        {tabs.map(tab => <Button key={tab.id} type="button" role="tab" aria-selected={visibleTab === tab.id} variation={activeTab === tab.id ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab.id)}>{tab.label}</Button>)}
      </div>
      <RequestState
        isLoading={membersQuery.isLoading}
        isFetching={membersQuery.isFetching}
        isError={membersQuery.isError}
        isEmpty={membersQuery.isSuccess && totalMembers === 0}
        emptyMessage={t(visibleTab === 'all' ? 'COMMUNITY_MEMBERS_EMPTY' : visibleTab === 'staff' ? 'COMMUNITY_STAFF_EMPTY' : 'COMMUNITY_BANNED_EMPTY')}
        onRetry={() => void membersQuery.refetch()}
      >
        <div className="account-card__profile-list">{members.map(renderMember)}</div>
      </RequestState>
      <Pagination page={page} pageSize={pageSize} totalItems={totalMembers} onPageChange={setPage} />
    </section></main>
  )
}

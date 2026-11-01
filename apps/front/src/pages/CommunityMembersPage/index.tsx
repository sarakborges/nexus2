import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Profile } from '@nexus/common'
import { CommunityMemberActions, Pagination } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { getCommunityMembers, getPendingCommunityMembers } from '@/Services/CommunityRelationship'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityStore } from '@/Stores/Community.store'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

type MemberTab = 'all' | 'staff' | 'banned'
type Member = Profile & { role: string }

export function CommunityMembersPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const community = useCommunityStore(state => state.community)
  const loadedUrl = useCommunityStore(state => state.loadedUrl)
  const loadCommunityByUrl = useCommunityStore(state => state.loadCommunityByUrl)
  const clearCommunity = useCommunityStore(state => state.clearCommunity)
  const session = useAuthStore(state => state.session)
  const relationships = useCommunityRelationshipStore(state => state.relationships)
  const getRelationship = useCommunityRelationshipStore(state => state.getRelationship)
  const loadRelationships = useCommunityRelationshipStore(state => state.loadRelationships)
  const currentProfileId = session?.user.currentProfile ?? null
  const currentRole = community && currentProfileId ? getRelationship(currentProfileId, community.id)?.type ?? null : null
  const isStaff = currentRole === 'owner' || currentRole === 'moderator'
  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const [members, setMembers] = useState<Member[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [pending, setPending] = useState<Member[]>([])
  const [totalPending, setTotalPending] = useState(0)
  const { page, pageSize, setPage } = useUrlPagination('page')
  const { page: pendingPage, pageSize: pendingPageSize, setPage: setPendingPage } = useUrlPagination('pendingPage')

  useEffect(() => { if (normalized) void loadCommunityByUrl(normalized); else clearCommunity() }, [normalized, loadCommunityByUrl, clearCommunity])
  useEffect(() => { if (community) void loadRelationships(community.id).catch(() => undefined) }, [community?.id, loadRelationships])

  useEffect(() => {
    if (!community) return
    let active = true
    void getCommunityMembers(community.id, activeTab, { page, pageSize }).then(result => {
      if (active) { setMembers(result.items); setTotalMembers(result.totalItems); if (result.page !== page) setPage(result.page) }
    }).catch(() => { if (active) { setMembers([]); setTotalMembers(0) } })
    return () => { active = false }
  }, [community?.id, activeTab, page, pageSize, relationships, setPage])

  useEffect(() => {
    if (!community || !currentProfileId || !isStaff) { setPending([]); setTotalPending(0); return }
    let active = true
    void getPendingCommunityMembers(community.id, currentProfileId, { page: pendingPage, pageSize: pendingPageSize }).then(result => {
      if (active) { setPending(result.items); setTotalPending(result.totalItems); if (result.page !== pendingPage) setPendingPage(result.page) }
    }).catch(() => { if (active) { setPending([]); setTotalPending(0) } })
    return () => { active = false }
  }, [community?.id, currentProfileId, isStaff, pendingPage, pendingPageSize, relationships, setPendingPage])

  useEffect(() => { setPage(1) }, [activeTab, community?.id, setPage])

  if (loadedUrl !== normalized) return null
  if (!community) return <NotFoundPage />

  const renderMember = (profile: Member) => {
    const roleKey = profile.role === 'owner' ? 'COMMUNITY_ROLE_OWNER' : profile.role === 'moderator' ? 'COMMUNITY_ROLE_MODERATOR' : profile.role === 'connection' ? 'COMMUNITY_ROLE_MEMBER' : null
    return (
      <div className="account-card__profile-entry" key={profile.id}>
        <div className="community-member__identity">
          <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{profile.name}</Link>
          {roleKey && <span className="community-member__role">{t(roleKey)}</span>}
        </div>
        {isStaff && currentProfileId && profile.role !== 'owner' && (
          <CommunityMemberActions memberProfileId={profile.id} communityId={community.id} actorProfileId={currentProfileId} actorRole={currentRole as 'owner' | 'moderator'} />
        )}
      </div>
    )
  }
  const tabs: Array<{ id: MemberTab; label: string }> = [
    { id: 'all', label: t('COMMUNITY_TAB_ALL') },
    { id: 'staff', label: t('COMMUNITY_TAB_STAFF') },
    { id: 'banned', label: t('COMMUNITY_TAB_BANNED') }
  ]

  return (
    <main className="account-page"><section className="account-card">
      <header className="account-card__header">
        <div><h1 className="account-card__title">{t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}</h1><p className="account-card__description">{t('COMMUNITY_MEMBERS_DESCRIPTION')}</p></div>
        <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
      </header>
      {isStaff && totalPending > 0 && (
        <section className="account-card__profile-list">
          <h2>{t('COMMUNITY_PENDING_REQUESTS')}</h2>
          {pending.map(renderMember)}
          <Pagination page={pendingPage} pageSize={pendingPageSize} totalItems={totalPending} onPageChange={setPendingPage} />
        </section>
      )}
      <div className="community-member__tabs" role="tablist">
        {tabs.map(tab => <Button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} variation={activeTab === tab.id ? 'primary' : 'secondary'} onClick={() => setActiveTab(tab.id)}>{tab.label}</Button>)}
      </div>
      {members.length === 0 ? <p className="account-card__description">{t(activeTab === 'all' ? 'COMMUNITY_MEMBERS_EMPTY' : activeTab === 'staff' ? 'COMMUNITY_STAFF_EMPTY' : 'COMMUNITY_BANNED_EMPTY')}</p> : (
        <div className="account-card__profile-list">{members.map(renderMember)}</div>
      )}
      <Pagination page={page} pageSize={pageSize} totalItems={totalMembers} onPageChange={setPage} />
    </section></main>
  )
}

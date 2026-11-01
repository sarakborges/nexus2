import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { CommunityMemberActions, Pagination } from '@/Components'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { getPageItems } from '@/Helpers/Math/pagination.helper'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityRelationshipType } from '@/Models/CommunityRelationship.model'
import type { Profile } from '@/Models/Profile.model'
import { getProfilesByIds } from '@/Services/Profile'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityStore } from '@/Stores/Community.store'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

type MemberTab = 'all' | 'staff' | 'banned'

const ROLE_TRANSLATION_KEYS: Record<
  'owner' | 'moderator' | 'connection',
  'COMMUNITY_ROLE_OWNER' | 'COMMUNITY_ROLE_MODERATOR' | 'COMMUNITY_ROLE_MEMBER'
> = {
  owner: 'COMMUNITY_ROLE_OWNER',
  moderator: 'COMMUNITY_ROLE_MODERATOR',
  connection: 'COMMUNITY_ROLE_MEMBER'
}

export function CommunityMembersPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const community = useCommunityStore((state) => state.community)
  const loadedUrl = useCommunityStore((state) => state.loadedUrl)
  const loadCommunityByUrl = useCommunityStore(
    (state) => state.loadCommunityByUrl
  )
  const clearCommunity = useCommunityStore((state) => state.clearCommunity)
  const session = useAuthStore((state) => state.session)
  const relationships = useCommunityRelationshipStore(
    (state) => state.relationships
  )
  const getRelationship = useCommunityRelationshipStore(
    (state) => state.getRelationship
  )
  const currentProfileId = session?.user.currentProfile ?? null
  const currentRole = community && currentProfileId
    ? getRelationship(currentProfileId, community.id)?.type ?? null
    : null
  const isOwner = currentRole === 'owner'
  const isStaff = isOwner || currentRole === 'moderator'
  const [activeTab, setActiveTab] = useState<MemberTab>('all')
  const [page, setPage] = useState(1)
  const [pendingPage, setPendingPage] = useState(1)

  useEffect(() => {
    if (requestedUrl) {
      loadCommunityByUrl(requestedUrl)
    } else {
      clearCommunity()
    }
  }, [requestedUrl, loadCommunityByUrl, clearCommunity])

  const lists = useMemo(() => {
    if (!community) {
      return {
        all: [] as Profile[],
        staff: [] as Profile[],
        banned: [] as Profile[],
        pending: [] as Profile[]
      }
    }

    const communityRelationships = relationships.filter(
      (item) => item.profiles[1] === community.id
    )
    const getByType = (types: CommunityRelationshipType[]) =>
      getProfilesByIds(
        communityRelationships
          .filter((item) => types.includes(item.type))
          .map((item) => item.profiles[0])
      )

    return {
      all: getByType(['owner', 'moderator', 'connection']),
      staff: getByType(['owner', 'moderator']),
      banned: getByType(['blocked']),
      pending: isStaff ? getByType(['requested']) : []
    }
  }, [community, relationships, isStaff])

  const visibleProfiles = lists[activeTab]
  const pageProfiles = getPageItems(visibleProfiles, page, DEFAULT_PAGE_SIZE)
  const pendingPageProfiles = getPageItems(
    lists.pending,
    pendingPage,
    DEFAULT_PAGE_SIZE
  )

  useEffect(() => {
    setPage(1)
    setPendingPage(1)
  }, [activeTab, community?.id])

  useEffect(() => {
    setPage((currentPage) =>
      Math.min(
        currentPage,
        Math.max(1, Math.ceil(visibleProfiles.length / DEFAULT_PAGE_SIZE))
      )
    )
    setPendingPage((currentPage) =>
      Math.min(
        currentPage,
        Math.max(1, Math.ceil(lists.pending.length / DEFAULT_PAGE_SIZE))
      )
    )
  }, [visibleProfiles.length, lists.pending.length])

  if (loadedUrl !== requestedUrl) {
    return null
  }

  if (!community) {
    return <NotFoundPage />
  }

  const tabs: Array<{ id: MemberTab; label: string }> = [
    { id: 'all', label: t('COMMUNITY_TAB_ALL') },
    { id: 'staff', label: t('COMMUNITY_TAB_STAFF') },
    { id: 'banned', label: t('COMMUNITY_TAB_BANNED') }
  ]

  const renderProfileRow = (profile: Profile) => {
    const role = getRelationship(profile.id, community.id)?.type
    const roleLabel =
      role && role in ROLE_TRANSLATION_KEYS
        ? t(ROLE_TRANSLATION_KEYS[role as keyof typeof ROLE_TRANSLATION_KEYS])
        : null

    return (
      <div className="account-card__profile-entry" key={profile.id}>
        <div className="community-member__identity">
          <Link
            className="account-card__link"
            to={`${ROUTES.profile}/${profile.url}`}
          >
            {profile.name}
          </Link>
          {roleLabel && (
            <span className="community-member__role">{roleLabel}</span>
          )}
        </div>
        {isStaff && currentProfileId && role !== 'owner' && (
          <CommunityMemberActions
            memberProfileId={profile.id}
            communityId={community.id}
            actorProfileId={currentProfileId}
            actorRole={currentRole as 'owner' | 'moderator'}
          />
        )}
      </div>
    )
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">
              {t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}
            </h1>
            <p className="account-card__description">
              {t('COMMUNITY_MEMBERS_DESCRIPTION')}
            </p>
          </div>
          <Link
            className="account-card__link"
            to={`${ROUTES.community}/${community.url}`}
          >
            {t('COMMUNITY_BACK_TO_PAGE')}
          </Link>
        </header>

        {isStaff && lists.pending.length > 0 && (
          <section className="account-card__profile-list">
            <h2>{t('COMMUNITY_PENDING_REQUESTS')}</h2>
            {pendingPageProfiles.map((profile) => (
              <div className="account-card__profile-entry" key={profile.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.profile}/${profile.url}`}
                >
                  {profile.name}
                </Link>
                {currentProfileId && (
                  <CommunityMemberActions
                    memberProfileId={profile.id}
                    communityId={community.id}
                    actorProfileId={currentProfileId}
                    actorRole={currentRole as 'owner' | 'moderator'}
                  />
                )}
              </div>
            ))}
            <Pagination
              page={pendingPage}
              totalItems={lists.pending.length}
              onPageChange={setPendingPage}
            />
          </section>
        )}

        <div className="community-member__tabs" role="tablist">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              variation={activeTab === tab.id ? 'primary' : 'secondary'}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {pageProfiles.length === 0 ? (
          <p className="account-card__description">
            {t(
              activeTab === 'all'
                ? 'COMMUNITY_MEMBERS_EMPTY'
                : activeTab === 'staff'
                  ? 'COMMUNITY_STAFF_EMPTY'
                  : 'COMMUNITY_BANNED_EMPTY'
            )}
          </p>
        ) : (
          <div className="account-card__profile-list">
            {pageProfiles.map(renderProfileRow)}
          </div>
        )}

        <Pagination
          page={page}
          totalItems={visibleProfiles.length}
          onPageChange={setPage}
        />
      </section>
    </main>
  )
}

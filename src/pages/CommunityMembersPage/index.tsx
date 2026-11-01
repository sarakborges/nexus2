import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { CommunityMemberActions } from '@/Components'
import type { Profile } from '@/Models/Profile.model'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityStore } from '@/Stores/Community.store'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

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
  const getMemberProfileIds = useCommunityRelationshipStore(
    (state) => state.getMemberProfileIds
  )
  const getPendingProfileIds = useCommunityRelationshipStore(
    (state) => state.getPendingProfileIds
  )
  const getBlockedProfileIds = useCommunityRelationshipStore(
    (state) => state.getBlockedProfileIds
  )
  const getRelationship = useCommunityRelationshipStore(
    (state) => state.getRelationship
  )
  const relationships = useCommunityRelationshipStore(
    (state) => state.relationships
  )
  const currentProfileId = session?.user.currentProfile ?? null
  const isOwner = Boolean(
    community &&
      currentProfileId &&
      getRelationship(currentProfileId, community.id)?.type === 'owner'
  )
  const [members, setMembers] = useState<Profile[]>([])
  const [pendingProfiles, setPendingProfiles] = useState<Profile[]>([])
  const [blockedProfiles, setBlockedProfiles] = useState<Profile[]>([])

  useEffect(() => {
    if (requestedUrl) {
      loadCommunityByUrl(requestedUrl)
    } else {
      clearCommunity()
    }
  }, [requestedUrl, loadCommunityByUrl, clearCommunity])

  useEffect(() => {
    setMembers(
      community
        ? getProfilesByIds(getMemberProfileIds(community.id))
        : []
    )
    setPendingProfiles(
      community && isOwner
        ? getProfilesByIds(getPendingProfileIds(community.id))
        : []
    )
    setBlockedProfiles(
      community && isOwner
        ? getProfilesByIds(getBlockedProfileIds(community.id))
        : []
    )
  }, [
    community,
    relationships,
    isOwner,
    getMemberProfileIds,
    getPendingProfileIds,
    getBlockedProfileIds
  ])

  if (loadedUrl !== requestedUrl) {
    return null
  }

  if (!community) {
    return <NotFoundPage />
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <h1 className="account-card__title">
          {t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}
        </h1>

        {isOwner && (
          <section className="account-card__profile-list">
            <h2>{t('COMMUNITY_PENDING_REQUESTS')}</h2>
            {pendingProfiles.length === 0 ? (
              <p className="account-card__description">
                {t('COMMUNITY_MEMBERS_PENDING_EMPTY')}
              </p>
            ) : (
              pendingProfiles.map((profile) => (
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
                      ownerProfileId={currentProfileId}
                    />
                  )}
                </div>
              ))
            )}
          </section>
        )}

        <section className="account-card__profile-list">
          <h2>{t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}</h2>
          {members.length === 0 ? (
            <p className="account-card__description">
              {t('COMMUNITY_MEMBERS_EMPTY')}
            </p>
          ) : (
            members.map((member) => (
              <div className="account-card__profile-entry" key={member.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.profile}/${member.url}`}
                >
                  {member.name}
                </Link>
                {isOwner &&
                  currentProfileId &&
                  member.id !== currentProfileId && (
                    <CommunityMemberActions
                      memberProfileId={member.id}
                      communityId={community.id}
                      ownerProfileId={currentProfileId}
                    />
                  )}
              </div>
            ))
          )}
        </section>

        {isOwner && (
          <section className="account-card__profile-list">
            <h2>{t('COMMUNITY_BLOCKED_MEMBERS')}</h2>
            {blockedProfiles.length === 0 ? (
              <p className="account-card__description">
                {t('COMMUNITY_BLOCKED_MEMBERS_EMPTY')}
              </p>
            ) : (
              blockedProfiles.map((profile) => (
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
                      ownerProfileId={currentProfileId}
                    />
                  )}
                </div>
              ))
            )}
          </section>
        )}

        <Link
          className="account-card__link"
          to={`${ROUTES.community}/${community.url}`}
        >
          {t('COMMUNITY_BACK_TO_PAGE')}
        </Link>
      </section>
    </main>
  )
}

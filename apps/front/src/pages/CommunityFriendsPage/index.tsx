import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import type { Profile } from '@/Models/Profile.model'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { useCommunityStore } from '@/Stores/Community.store'
import { useRelationshipStore } from '@/Stores/Relationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

export function CommunityFriendsPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const community = useCommunityStore((state) => state.community)
  const loadedUrl = useCommunityStore((state) => state.loadedUrl)
  const loadCommunityByUrl = useCommunityStore(
    (state) => state.loadCommunityByUrl
  )
  const clearCommunity = useCommunityStore((state) => state.clearCommunity)
  const getRelatedIds = useRelationshipStore((state) => state.getRelatedIds)
  const relationships = useRelationshipStore((state) => state.relationships)
  const [members, setMembers] = useState<Profile[]>([])

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
        ? getProfilesByIds(getRelatedIds(community.id, 'connection'))
        : []
    )
  }, [community, relationships, getRelatedIds])

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

        {members.length === 0 ? (
          <p className="account-card__description">
            {t('COMMUNITY_MEMBERS_EMPTY')}
          </p>
        ) : (
          <div className="account-card__profile-list">
            {members.map((member) => (
              <div className="account-card__profile-entry" key={member.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.profile}/${member.url}`}
                >
                  {member.name}
                </Link>
              </div>
            ))}
          </div>
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

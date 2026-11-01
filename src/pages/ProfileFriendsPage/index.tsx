import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import type { Profile } from '@/Models/Profile.model'
import { RelationshipActions } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getProfilesByIds } from '@/Services/Profile'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { useRelationshipStore } from '@/Stores/Relationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

export function ProfileFriendsPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore((state) => state.profile)
  const loadedUrl = useProfileStore((state) => state.loadedUrl)
  const loadProfileByUrl = useProfileStore((state) => state.loadProfileByUrl)
  const clearProfile = useProfileStore((state) => state.clearProfile)
  const session = useAuthStore((state) => state.session)
  const getRelatedIds = useRelationshipStore((state) => state.getRelatedIds)
  const relationships = useRelationshipStore((state) => state.relationships)
  const [friends, setFriends] = useState<Profile[]>([])

  useEffect(() => {
    if (requestedUrl) {
      loadProfileByUrl(requestedUrl)
    } else {
      clearProfile()
    }
  }, [requestedUrl, loadProfileByUrl, clearProfile])

  useEffect(() => {
    setFriends(
      profile
        ? getProfilesByIds(getRelatedIds(profile.id, 'connection'))
        : []
    )
  }, [profile, relationships, getRelatedIds])

  if (loadedUrl !== requestedUrl) {
    return null
  }

  if (!profile) {
    return <NotFoundPage />
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <h1 className="account-card__title">
          {t('PROFILE_FRIENDS_TITLE', { name: profile.name })}
        </h1>

        {friends.length === 0 ? (
          <p className="account-card__description">
            {t('RELATIONSHIP_FRIENDS_EMPTY')}
          </p>
        ) : (
          <div className="account-card__profile-list">
            {friends.map((friend) => (
              <div className="account-card__profile-entry" key={friend.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.profile}/${friend.url}`}
                >
                  {friend.name}
                </Link>
                {session?.user.currentProfile === profile.id && (
                  <RelationshipActions targetId={friend.id} />
                )}
              </div>
            ))}
          </div>
        )}

        <Link
          className="account-card__link"
          to={`${ROUTES.profile}/${profile.url}`}
        >
          {t('COMMUNITY_BACK_TO_PAGE')}
        </Link>
      </section>
    </main>
  )
}

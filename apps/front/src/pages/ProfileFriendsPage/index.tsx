import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Profile } from '@nexus/common'
import { Pagination, RelationshipActions } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileFriends } from '@/Services/Relationship'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { useRelationshipStore } from '@/Stores/Relationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

export function ProfileFriendsPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore(state => state.profile)
  const loadedUrl = useProfileStore(state => state.loadedUrl)
  const loadProfileByUrl = useProfileStore(state => state.loadProfileByUrl)
  const clearProfile = useProfileStore(state => state.clearProfile)
  const session = useAuthStore(state => state.session)
  const loadRelationships = useRelationshipStore(state => state.loadRelationships)
  const { page, pageSize, setPage } = useUrlPagination()
  const [friends, setFriends] = useState<Profile[]>([])
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => { if (normalized) void loadProfileByUrl(normalized); else clearProfile() }, [normalized, loadProfileByUrl, clearProfile])
  useEffect(() => {
    if (!profile) { setFriends([]); setTotalItems(0); return }
    let active = true
    void getProfileFriends(profile.id, { page, pageSize }).then(result => {
      if (active) { setFriends(result.items); setTotalItems(result.totalItems); if (result.page !== page) setPage(result.page) }
    }).catch(() => { if (active) { setFriends([]); setTotalItems(0) } })
    if (session?.user.currentProfile === profile.id) void loadRelationships(profile.id).catch(() => undefined)
    return () => { active = false }
  }, [profile?.id, page, pageSize, loadRelationships, session?.user.currentProfile, setPage])

  if (loadedUrl !== normalized) return null
  if (!profile) return <NotFoundPage />
  return (
    <main className="account-page"><section className="account-card">
      <h1 className="account-card__title">{t('PROFILE_FRIENDS_TITLE', { name: profile.name })}</h1>
      {friends.length === 0 ? <p className="account-card__description">{t('RELATIONSHIP_FRIENDS_EMPTY')}</p> : (
        <div className="account-card__profile-list">{friends.map(friend => (
          <div className="account-card__profile-entry" key={friend.id}>
            <Link className="account-card__link" to={`${ROUTES.profile}/${friend.url}`}>{friend.name}</Link>
            {session?.user.currentProfile === profile.id && <RelationshipActions targetId={friend.id} />}
          </div>
        ))}</div>
      )}
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
    </section></main>
  )
}

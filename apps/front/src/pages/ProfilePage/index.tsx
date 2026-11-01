import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { RelationshipActions } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import type { ProfileType } from '@/Models/Profile.model'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { useRelationshipStore } from '@/Stores/Relationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

const PROFILE_TYPE_TRANSLATION_KEYS: Record<ProfileType, 'PROFILE_TYPE_SOCIAL' | 'PROFILE_TYPE_RP' | 'PROFILE_TYPE_BUSINESS'> = {
  social: 'PROFILE_TYPE_SOCIAL', rp: 'PROFILE_TYPE_RP', business: 'PROFILE_TYPE_BUSINESS'
}
export function ProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore(state => state.profile)
  const loadedUrl = useProfileStore(state => state.loadedUrl)
  const loadProfileByUrl = useProfileStore(state => state.loadProfileByUrl)
  const clearProfile = useProfileStore(state => state.clearProfile)
  const session = useAuthStore(state => state.session)
  const loadRelationships = useRelationshipStore(state => state.loadRelationships)
  useEffect(() => { if (requestedUrl) void loadProfileByUrl(requestedUrl); else clearProfile() }, [requestedUrl, loadProfileByUrl, clearProfile])
  useEffect(() => {
    const source = session?.user.currentProfile
    if (source) void loadRelationships(source).catch(() => undefined)
  }, [session?.user.currentProfile, loadRelationships])
  if (loadedUrl !== requestedUrl) return null
  if (!profile) return <NotFoundPage />
  return (
    <main className="account-page"><article className="account-card">
      {profile.picture && <img className="account-card__picture" src={profile.picture} alt={t('PROFILE_PICTURE_ALT', { name: profile.name })} />}
      <div>
        <h1 className="account-card__title">{profile.name}</h1>
        <p className="account-card__description">{t(PROFILE_TYPE_TRANSLATION_KEYS[profile.type])}</p>
        {profile.about && <p className="account-card__description">{profile.about}</p>}
      </div>
      <RelationshipActions targetId={profile.id} />
      <div className="account-card__actions">
        <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}/friends`}>{t('PROFILE_FRIENDS_LINK')}</Link>
        <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}/communities`}>{t('PROFILE_COMMUNITIES_LINK')}</Link>
        <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}/messages`}>{t('PROFILE_MESSAGES_LINK')}</Link>
      </div>
      <p className="account-card__profile-link">/profile/{profile.url}</p>
    </article></main>
  )
}

import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { RelationshipActions } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import type { ProfileType } from '@/Models/Profile.model'
import { useTranslations } from '@/Hooks/Language'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityStore } from '@/Stores/Community.store'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

const PROFILE_TYPE_TRANSLATION_KEYS: Record<ProfileType, 'PROFILE_TYPE_SOCIAL' | 'PROFILE_TYPE_RP' | 'PROFILE_TYPE_BUSINESS'> = {
  social: 'PROFILE_TYPE_SOCIAL', rp: 'PROFILE_TYPE_RP', business: 'PROFILE_TYPE_BUSINESS'
}
export function CommunityPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const community = useCommunityStore(state => state.community)
  const loadedUrl = useCommunityStore(state => state.loadedUrl)
  const loadCommunityByUrl = useCommunityStore(state => state.loadCommunityByUrl)
  const clearCommunity = useCommunityStore(state => state.clearCommunity)
  const loadRelationships = useCommunityRelationshipStore(state => state.loadRelationships)
  const session = useAuthStore(state => state.session)
  const communityId = community?.id
  useEffect(() => { if (requestedUrl) void loadCommunityByUrl(requestedUrl); else clearCommunity() }, [requestedUrl, loadCommunityByUrl, clearCommunity])
  useEffect(() => { if (communityId) void loadRelationships(communityId).catch(() => undefined) }, [communityId, loadRelationships, session?.user.id])
  if (loadedUrl !== requestedUrl) return null
  if (!community) return <NotFoundPage />
  return (
    <main className="account-page"><article className="account-card">
      {community.picture && <img className="account-card__picture" src={community.picture} alt={t('COMMUNITY_PICTURE_ALT', { name: community.name })} />}
      <div>
        <h1 className="account-card__title">{community.name}</h1>
        <p className="account-card__description">{t(PROFILE_TYPE_TRANSLATION_KEYS[community.type])}</p>
        {community.about && <p className="account-card__description">{community.about}</p>}
      </div>
      <RelationshipActions targetId={community.id} targetKind="community" />
      <Link className="account-card__link" to={`${ROUTES.community}/${community.url}/members`}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
      <p className="account-card__profile-link">/community/{community.url}</p>
    </article></main>
  )
}

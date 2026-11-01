import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { RelationshipActions, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import type { ProfileType } from '@/Models/Profile.model'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityByUrl } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

const PROFILE_TYPE_TRANSLATION_KEYS: Record<ProfileType, 'PROFILE_TYPE_SOCIAL' | 'PROFILE_TYPE_RP' | 'PROFILE_TYPE_BUSINESS'> = {
  social: 'PROFILE_TYPE_SOCIAL', rp: 'PROFILE_TYPE_RP', business: 'PROFILE_TYPE_BUSINESS'
}

export function CommunityPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (communityQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
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

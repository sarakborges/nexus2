import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import type { Community } from '@nexus/common'
import { Pagination } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getProfileCommunities } from '@/Services/Community'
import { useProfileStore } from '@/Stores/Profile.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'

export function ProfileCommunitiesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore(state => state.profile)
  const loadedUrl = useProfileStore(state => state.loadedUrl)
  const loadProfileByUrl = useProfileStore(state => state.loadProfileByUrl)
  const clearProfile = useProfileStore(state => state.clearProfile)
  const { page, pageSize, setPage } = useUrlPagination()
  const [communities, setCommunities] = useState<Community[]>([])
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => { if (normalized) void loadProfileByUrl(normalized); else clearProfile() }, [normalized, loadProfileByUrl, clearProfile])
  useEffect(() => {
    if (!profile) { setCommunities([]); setTotalItems(0); return }
    let active = true
    void getProfileCommunities(profile.id, { page, pageSize }).then(result => {
      if (active) { setCommunities(result.items); setTotalItems(result.totalItems) }
    }).catch(() => { if (active) { setCommunities([]); setTotalItems(0) } })
    return () => { active = false }
  }, [profile?.id, page, pageSize])

  if (loadedUrl !== normalized) return null
  if (!profile) return <NotFoundPage />
  return (
    <main className="account-page"><section className="account-card">
      <h1 className="account-card__title">{t('PROFILE_COMMUNITIES_TITLE', { name: profile.name })}</h1>
      {communities.length === 0 ? <p className="account-card__description">{t('PROFILE_COMMUNITIES_EMPTY')}</p> : (
        <div className="account-card__profile-list">{communities.map(community => (
          <div className="account-card__profile-entry" key={community.id}>
            <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{community.name}</Link>
          </div>
        ))}</div>
      )}
      <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
      <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
    </section></main>
  )
}

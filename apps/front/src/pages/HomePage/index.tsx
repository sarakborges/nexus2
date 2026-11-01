import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Profile } from '@nexus/common'
import type { PaginatedResult } from '@nexus/common'
import { Pagination } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getOwnedProfiles } from '@/Services/Profile'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthenticatedPage.style.scss'

export function HomePage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const setCurrentProfile = useAuthStore(state => state.setCurrentProfile)
  const signOut = useAuthStore(state => state.signOut)
  const { page, pageSize, setPage } = useUrlPagination()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const userId = session?.user.id

  useEffect(() => {
    let active = true
    if (userId) {
      void getOwnedProfiles({ page, pageSize }).then((result: PaginatedResult<Profile>) => {
        if (active) { setProfiles(result.items); setTotalItems(result.totalItems); if (result.page !== page) setPage(result.page) }
      }).catch(() => { if (active) { setProfiles([]); setTotalItems(0) } })
    }
    return () => { active = false }
  }, [userId, page, pageSize, setPage])

  const handleSignOut = async () => {
    await signOut()
    navigate(ROUTES.signIn, { replace: true })
  }
  const handleSelectProfile = async (profileId: string) => { await setCurrentProfile(profileId) }
  const currentProfileId = session?.user.currentProfile
  const visibleProfiles = userId ? profiles : []
  const visibleTotalItems = userId ? totalItems : 0

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('HOME_TITLE')}</h1>
            <p className="account-card__description">{t('HOME_WELCOME', { name: visibleProfiles.find(profile => profile.id === currentProfileId)?.name ?? '' })}</p>
          </div>
          <Button variation="transparent" onClick={() => void handleSignOut()}>{t('AUTH_SIGN_OUT')}</Button>
        </header>
        <p className="account-card__description">{session?.user.email}</p>
        <div className="account-card__profile-list">
          <h2>{t('HOME_PROFILES_TITLE')}</h2>
          {visibleProfiles.map(profile => {
            const current = profile.id === currentProfileId
            return (
              <div className="account-card__profile-entry" key={profile.id}>
                <Link className="account-card__link" to={`${ROUTES.profile}/${profile.url}`}>{profile.name} · /profile/{profile.url}</Link>
                {current ? <span className="account-card__current-profile">{t('HOME_CURRENT_PROFILE')}</span> : <Button variation="secondary" onClick={() => void handleSelectProfile(profile.id)}>{t('HOME_USE_PROFILE')}</Button>}
              </div>
            )
          })}
          <Pagination page={page} pageSize={pageSize} totalItems={visibleTotalItems} onPageChange={setPage} />
        </div>
        <div className="account-card__actions">
          <Link className="account-card__action" to={ROUTES.createProfile}>{t('HOME_CREATE_PROFILE')}</Link>
          <Link className="account-card__action" to={ROUTES.communities}>{t('COMMUNITIES_TITLE')}</Link>
          <Link className="account-card__action" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</Link>
        </div>
      </section>
    </main>
  )
}

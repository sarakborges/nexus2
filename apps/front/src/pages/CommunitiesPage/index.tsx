import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Community } from '@nexus/common'
import { Pagination } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const { page, pageSize, setPage } = useUrlPagination()
  const [communities, setCommunities] = useState<Community[]>([])
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    let active = true
    void getCommunities({ page, pageSize }).then(result => {
      if (active) { setCommunities(result.items); setTotalItems(result.totalItems) }
    }).catch(() => { if (active) { setCommunities([]); setTotalItems(0) } })
    return () => { active = false }
  }, [page, pageSize])

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('COMMUNITIES_TITLE')}</h1>
          <Link className="account-card__action" to={ROUTES.createCommunity}>{t('COMMUNITIES_CREATE')}</Link>
        </header>
        {totalItems === 0 ? <p className="account-card__description">{t('COMMUNITIES_EMPTY')}</p> : (
          <div className="account-card__profile-list">
            {communities.map(community => (
              <div className="account-card__profile-entry" key={community.id}>
                <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{community.name} · /community/{community.url}</Link>
              </div>
            ))}
          </div>
        )}
        <Pagination page={page} pageSize={pageSize} totalItems={totalItems} onPageChange={setPage} />
        <Link className="account-card__link" to={ROUTES.home}>{t('PROFILE_BACK_HOME')}</Link>
      </section>
    </main>
  )
}

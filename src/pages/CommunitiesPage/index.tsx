import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Pagination } from '@/Components'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { ROUTES } from '@/Constants/routes'
import { getPageItems } from '@/Helpers/Math/pagination.helper'
import { useTranslations } from '@/Hooks/Language'
import type { Community } from '@/Models/Community.model'
import { getCommunities } from '@/Services/Community'

import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const [communities, setCommunities] = useState<Community[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    setCommunities(getCommunities())
  }, [])

  const pageCommunities = getPageItems(
    communities,
    page,
    DEFAULT_PAGE_SIZE
  )

  return (
    <main className="account-page">
      <section className="account-card">
        <header className="account-card__header">
          <h1 className="account-card__title">{t('COMMUNITIES_TITLE')}</h1>
          <Link className="account-card__action" to={ROUTES.createCommunity}>
            {t('COMMUNITIES_CREATE')}
          </Link>
        </header>

        {communities.length === 0 ? (
          <p className="account-card__description">
            {t('COMMUNITIES_EMPTY')}
          </p>
        ) : (
          <div className="account-card__profile-list">
            {pageCommunities.map((community) => (
              <div className="account-card__profile-entry" key={community.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.community}/${community.url}`}
                >
                  {community.name} · /community/{community.url}
                </Link>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalItems={communities.length}
          onPageChange={setPage}
        />

        <Link className="account-card__link" to={ROUTES.home}>
          {t('PROFILE_BACK_HOME')}
        </Link>
      </section>
    </main>
  )
}

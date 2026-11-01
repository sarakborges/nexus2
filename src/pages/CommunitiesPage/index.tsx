import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import type { Community } from '@/Models/Community.model'
import { ROUTES } from '@/Constants/routes'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getCommunities } from '@/Services/Community'

import '../AuthenticatedPage.style.scss'

export function CommunitiesPage() {
  const { t } = useTranslations()
  const [communities, setCommunities] = useState<Community[]>([])

  useEffect(() => {
    setCommunities(getCommunities())
  }, [])

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
            {communities.map((community) => (
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

        <Link className="account-card__link" to={ROUTES.home}>
          {t('PROFILE_BACK_HOME')}
        </Link>
      </section>
    </main>
  )
}

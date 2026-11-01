import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Pagination } from '@/Components'
import { DEFAULT_PAGE_SIZE } from '@/Constants/pagination'
import { ROUTES } from '@/Constants/routes'
import { getPageItems } from '@/Helpers/Math/pagination.helper'
import type { Community } from '@/Models/Community.model'
import { useTranslations } from '@/Hooks/Language'
import { getCommunitiesByIds } from '@/Services/Community'
import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'
import { useProfileStore } from '@/Stores/Profile.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

export function ProfileCommunitiesPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profile = useProfileStore((state) => state.profile)
  const loadedUrl = useProfileStore((state) => state.loadedUrl)
  const loadProfileByUrl = useProfileStore((state) => state.loadProfileByUrl)
  const clearProfile = useProfileStore((state) => state.clearProfile)
  const getCommunityIdsForProfile = useCommunityRelationshipStore(
    (state) => state.getCommunityIdsForProfile
  )
  const relationships = useCommunityRelationshipStore(
    (state) => state.relationships
  )
  const [communities, setCommunities] = useState<Community[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (requestedUrl) {
      loadProfileByUrl(requestedUrl)
    } else {
      clearProfile()
    }
  }, [requestedUrl, loadProfileByUrl, clearProfile])

  useEffect(() => {
    setCommunities(
      profile
        ? getCommunitiesByIds(getCommunityIdsForProfile(profile.id))
        : []
    )
    setPage(1)
  }, [profile, relationships, getCommunityIdsForProfile])

  if (loadedUrl !== requestedUrl) {
    return null
  }

  if (!profile) {
    return <NotFoundPage />
  }

  const pageCommunities = getPageItems(
    communities,
    page,
    DEFAULT_PAGE_SIZE
  )

  return (
    <main className="account-page">
      <section className="account-card">
        <h1 className="account-card__title">
          {t('PROFILE_COMMUNITIES_TITLE', { name: profile.name })}
        </h1>

        {communities.length === 0 ? (
          <p className="account-card__description">
            {t('PROFILE_COMMUNITIES_EMPTY')}
          </p>
        ) : (
          <div className="account-card__profile-list">
            {pageCommunities.map((community) => (
              <div className="account-card__profile-entry" key={community.id}>
                <Link
                  className="account-card__link"
                  to={`${ROUTES.community}/${community.url}`}
                >
                  {community.name}
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

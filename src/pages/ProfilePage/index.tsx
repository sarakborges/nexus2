import { useParams } from 'react-router'

import { useTranslations } from '@/Hooks/Language'
import { getProfileByUrl } from '@/Services/Profile'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthenticatedPage.style.scss'

export function ProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const profile = url ? getProfileByUrl(url) : null

  if (!profile) {
    return <NotFoundPage />
  }

  return (
    <main className="account-page">
      <article className="account-card">
        {profile.picture && (
          <img
            className="account-card__picture"
            src={profile.picture}
            alt={t('PROFILE_PICTURE_ALT', { name: profile.name })}
          />
        )}

        <div>
          <h1 className="account-card__title">{profile.name}</h1>
          {profile.about && (
            <p className="account-card__description">{profile.about}</p>
          )}
        </div>

        <p className="account-card__profile-link">
          /profile/{profile.url}
        </p>
      </article>
    </main>
  )
}

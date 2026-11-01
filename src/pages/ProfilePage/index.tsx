import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { useProfileStore } from '@/Stores/Profile.store'

import '../AuthenticatedPage.style.scss'

export function ProfilePage() {
  const { t } = useTranslations()
  const profile = useProfileStore((state) => state.profile)

  if (!profile) {
    return null
  }

  return (
    <main className="account-page">
      <section className="account-card">
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

        <a
          className="account-card__profile-link"
          href={profile.url}
          target="_blank"
          rel="noreferrer"
        >
          {profile.url}
        </a>

        <Link className="account-card__link" to={ROUTES.home}>
          {t('PROFILE_BACK_HOME')}
        </Link>
      </section>
    </main>
  )
}

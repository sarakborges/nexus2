import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import type { ProfileType } from '@/Models/Profile.model'
import { PROFILE_ERROR_TRANSLATION_KEYS } from '@/Constants/profile'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { ProfileError } from '@/Services/Profile'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileStore } from '@/Stores/Profile.store'

import '../AuthPage.style.scss'

export function CreateProfilePage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const user = useAuthStore((state) => state.session?.user)
  const setCurrentProfile = useAuthStore((state) => state.setCurrentProfile)
  const createProfile = useProfileStore((state) => state.createProfile)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [type, setType] = useState<ProfileType>('social')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')

    if (!user) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }

    setIsSubmitting(true)

    try {
      const profile = createProfile(user.id, {
        name,
        url,
        picture,
        about,
        type
      })

      if (!setCurrentProfile(profile.id)) {
        throw new Error('Unable to select the newly created profile.')
      }

      navigate(`${ROUTES.profile}/${profile.url}`, { replace: true })
    } catch (error) {
      const translationKey =
        error instanceof ProfileError
          ? PROFILE_ERROR_TRANSLATION_KEYS[error.code]
          : 'PROFILE_ERROR_GENERIC'

      setErrorMessage(t(translationKey))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="create-profile-title">
        <div>
          <h1 className="auth-card__title" id="create-profile-title">
            {t('CREATE_PROFILE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('CREATE_PROFILE_DESCRIPTION')}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            id="profile-name"
            label={t('PROFILE_NAME_LABEL')}
            type="text"
            autoComplete="nickname"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />

          <FormField
            id="profile-url"
            label={t('PROFILE_URL_LABEL')}
            type="text"
            placeholder="sara-borges"
            pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />

          <div className="form-field">
            <Label htmlFor="profile-type">{t('PROFILE_TYPE_LABEL')}</Label>
            <select
              className="input"
              id="profile-type"
              value={type}
              onChange={(event) => setType(event.target.value as ProfileType)}
              required
            >
              <option value="social">{t('PROFILE_TYPE_SOCIAL')}</option>
              <option value="rp">{t('PROFILE_TYPE_RP')}</option>
              <option value="business">{t('PROFILE_TYPE_BUSINESS')}</option>
            </select>
          </div>

          <FormField
            id="profile-picture"
            label={t('PROFILE_PICTURE_LABEL')}
            type="url"
            placeholder="https://example.com/image.jpg"
            value={picture}
            onChange={(event) => setPicture(event.target.value)}
          />

          <div className="form-field">
            <Label htmlFor="profile-about">{t('PROFILE_ABOUT_LABEL')}</Label>
            <textarea
              className="input auth-form__textarea"
              id="profile-about"
              name="about"
              rows={5}
              maxLength={500}
              value={about}
              onChange={(event) => setAbout(event.target.value)}
            />
          </div>

          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? t('AUTH_SUBMITTING')
              : t('CREATE_PROFILE_ACTION')}
          </Button>
        </form>
      </section>
    </main>
  )
}

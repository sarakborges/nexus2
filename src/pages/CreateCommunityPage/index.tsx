import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { ProfileType } from '@/Models/Profile.model'
import { CommunityError } from '@/Services/Community'
import { useAuthStore } from '@/Stores/Auth.store'
import { useCommunityStore } from '@/Stores/Community.store'

import '../AuthPage.style.scss'

export function CreateCommunityPage() {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const session = useAuthStore((state) => state.session)
  const createCommunity = useCommunityStore((state) => state.createCommunity)
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

    if (!session) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }

    setIsSubmitting(true)

    try {
      const community = createCommunity({
        name,
        url,
        picture,
        about,
        type
      })

      navigate(`${ROUTES.community}/${community.url}`, { replace: true })
    } catch (error) {
      const code = error instanceof CommunityError ? error.code : null
      const translationKey =
        code === 'COMMUNITY_URL_ALREADY_IN_USE'
          ? 'COMMUNITY_ERROR_URL_TAKEN'
          : code === 'INVALID_COMMUNITY'
            ? 'COMMUNITY_ERROR_INVALID'
            : code === 'STORAGE_UNAVAILABLE'
              ? 'COMMUNITY_ERROR_STORAGE'
              : 'COMMUNITY_ERROR_GENERIC'

      setErrorMessage(t(translationKey))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="create-community-title">
        <div>
          <h1 className="auth-card__title" id="create-community-title">
            {t('COMMUNITY_CREATE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('COMMUNITY_CREATE_DESCRIPTION')}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField
            id="community-name"
            label={t('COMMUNITY_NAME_LABEL')}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />

          <FormField
            id="community-url"
            label={t('COMMUNITY_URL_LABEL')}
            type="text"
            placeholder="community-name"
            pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            required
          />

          <div className="form-field">
            <Label htmlFor="community-type">{t('PROFILE_TYPE_LABEL')}</Label>
            <select
              className="input"
              id="community-type"
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
            id="community-picture"
            label={t('COMMUNITY_PICTURE_LABEL')}
            type="url"
            placeholder="https://example.com/image.jpg"
            value={picture}
            onChange={(event) => setPicture(event.target.value)}
          />

          <div className="form-field">
            <Label htmlFor="community-about">{t('COMMUNITY_ABOUT_LABEL')}</Label>
            <textarea
              className="input auth-form__textarea"
              id="community-about"
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
            {isSubmitting ? t('AUTH_SUBMITTING') : t('COMMUNITY_CREATE_ACTION')}
          </Button>
        </form>
      </section>
    </main>
  )
}

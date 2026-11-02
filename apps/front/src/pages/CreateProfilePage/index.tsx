import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { ProfileType } from '@/Models/Profile.model'
import { RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthPage.style.scss'

export function CreateProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const user = useAuthStore(state => state.session?.user)
  const setCurrentProfile = useAuthStore(state => state.setCurrentProfile)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [type, setType] = useState<ProfileType>('social')
  const [errorMessage, setErrorMessage] = useState('')
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const profile = await createUserProfile({ name, url, picture, about, type })
      const isCurrentProfileSet = await setCurrentProfile(profile.id)
      if (!isCurrentProfileSet) throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
      return profile
    },
    onSuccess: async profile => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(profile.url), profile)
      queryClient.setQueryData(queryKeys.auth.session, useAuthStore.getState().session)
      await queryClient.invalidateQueries({ queryKey: ['profiles', 'owned', user?.id] })
    }
  })
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!user) { navigate(ROUTES.signIn, { replace: true }); return }
    try {
      const profile = await createProfileMutation.mutateAsync()
      navigate(`${ROUTES.profile}/${profile.url}`, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'PROFILE_URL_ALREADY_IN_USE' ? 'PROFILE_ERROR_URL_TAKEN' : code === 'INVALID_PROFILE' ? 'PROFILE_ERROR_INVALID' : 'PROFILE_ERROR_GENERIC'
      setErrorMessage(t(key))
    }
  }
  return (
    <main className="auth-page"><section className="auth-card" aria-labelledby="create-profile-title">
      <div><h1 className="auth-card__title" id="create-profile-title">{t('CREATE_PROFILE_TITLE')}</h1><p className="auth-card__description">{t('CREATE_PROFILE_DESCRIPTION')}</p></div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField id="profile-name" label={t('PROFILE_NAME_LABEL')} type="text" autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
        <FormField id="profile-url" label={t('PROFILE_URL_LABEL')} type="text" placeholder="sara-borges" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
        <div className="form-field"><Label htmlFor="profile-type">{t('PROFILE_TYPE_LABEL')}</Label><select className="input" id="profile-type" value={type} onChange={event => setType(event.target.value as ProfileType)} required><option value="social">{t('PROFILE_TYPE_SOCIAL')}</option><option value="rp">{t('PROFILE_TYPE_RP')}</option><option value="business">{t('PROFILE_TYPE_BUSINESS')}</option></select></div>
        <FormField id="profile-picture" label={t('PROFILE_PICTURE_LABEL')} type="url" placeholder="https://example.com/image.jpg" value={picture} onChange={event => setPicture(event.target.value)} />
        <div className="form-field">
          <Label htmlFor="profile-about">{t('PROFILE_ABOUT_LABEL')}</Label>
          <RichTextEditor
            id="profile-about"
            value={about}
            onChange={setAbout}
            imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
            imageUrlPrompt={t('RICH_TEXT_IMAGE_URL_PROMPT')}
            placeholder={t('RICH_TEXT_PLACEHOLDER')}
          />
          <p className="account-card__description">{t('PROFILE_ABOUT_MAX_LENGTH')}</p>
        </div>
        {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
        <Button type="submit" disabled={createProfileMutation.isPending}>{createProfileMutation.isPending ? t('AUTH_SUBMITTING') : t('CREATE_PROFILE_ACTION')}</Button>
      </form>
    </section></main>
  )
}

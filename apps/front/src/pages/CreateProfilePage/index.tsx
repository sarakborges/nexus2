import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { ProfileType } from '@/Models/Profile.model'
import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createUserProfile, getProfileByUrl } from '@/Services/Profile'
import { getCurrentAuthSession } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import '../AuthPage.style.scss'

export function CreateProfilePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const user = session?.user
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const showToast = useToastStore(state => state.showToast)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [type, setType] = useState<ProfileType>('social')
  const [errorMessage, setErrorMessage] = useState('')
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      const created = await createUserProfile({ name, url, picture, about, type })
      const [backendSessionResult, backendProfileResult] = await Promise.allSettled([
        getCurrentAuthSession(),
        getProfileByUrl(created.url)
      ])
      const backendSession = backendSessionResult.status === 'fulfilled' ? backendSessionResult.value : null
      const backendProfile = backendProfileResult.status === 'fulfilled' ? backendProfileResult.value : null
      const profile = backendProfile?.id === created.id ? backendProfile : created

      const sessionMatchesProfile = backendSession?.user.id === user?.id &&
        backendSession.user.profiles.includes(profile.id)
      if (sessionMatchesProfile && backendSession) {
        useAuthStore.getState().setSession(backendSession)
      } else {
        useAuthStore.getState().addProfileToUser(profile.id, true)
      }

      let activated = await useAuthStore.getState().setCurrentProfile(profile.id)
      if (!activated) {
        const refreshedSession = await getCurrentAuthSession().catch(() => null)
        if (refreshedSession?.user.profiles.includes(profile.id)) {
          useAuthStore.getState().setSession(refreshedSession)
          activated = await useAuthStore.getState().setCurrentProfile(profile.id)
        }
      }

      return { profile, activationFailed: !activated }
    },
    onSuccess: async ({ profile, activationFailed }) => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(profile.url), profile)
      queryClient.setQueryData(queryKeys.auth.session, useAuthStore.getState().session)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profiles'] }),
        queryClient.invalidateQueries({ queryKey: ['auth'] }),
        queryClient.invalidateQueries({ queryKey: ['activity'] })
      ])
      showToast(t(activationFailed ? 'TOAST_PROFILE_CREATED_NOT_ACTIVE' : 'TOAST_PROFILE_CREATED'), activationFailed ? 'error' : undefined)
    }
  })
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!isAuthInitialized) return
    if (!user) { navigate(ROUTES.signIn, { replace: true }); return }
    try {
      const result = await createProfileMutation.mutateAsync()
      navigate(ROUTES.profile + '/' + result.profile.url, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'PROFILE_URL_ALREADY_IN_USE' ? 'PROFILE_ERROR_URL_TAKEN' : code === 'INVALID_PROFILE' ? 'PROFILE_ERROR_INVALID' : 'PROFILE_ERROR_GENERIC'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  if (!isAuthInitialized) {
    return <main className="auth-page"><section className="entity-form-page"><RequestState isLoading /></section></main>
  }

  return (
    <main className="auth-page">
      <section className="entity-form-page" aria-labelledby="create-profile-title">
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id="create-profile-title">{t('CREATE_PROFILE_TITLE')}</h1>
          <p className="auth-card__description">{t('CREATE_PROFILE_DESCRIPTION')}</p>
        </header>
        <form className="entity-form-page__form" onSubmit={handleSubmit}>
          <div className="entity-form-page__card">
            <FormField id="profile-name" label={t('PROFILE_NAME_LABEL')} type="text" autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
            <FormField id="profile-url" label={t('PROFILE_URL_LABEL')} type="text" placeholder="profile-name" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
            <AvatarUploadField label={t('PROFILE_PICTURE_LABEL')} value={picture} fallbackName={name} purpose="profile-avatar" onChange={setPicture}
              selectLabel={t('UPLOAD_SELECT_IMAGE')} changeLabel={t('UPLOAD_CHANGE_IMAGE')} removeLabel={t('UPLOAD_REMOVE_IMAGE')}
              uploadingLabel={t('UPLOAD_IN_PROGRESS')} errorLabel={t('UPLOAD_FAILED')} emptyLabel={t('UPLOAD_EMPTY')} />
            <div className="form-field">
              <Label id="profile-about-label" htmlFor="profile-about">{t('PROFILE_ABOUT_LABEL')}</Label>
              <RichTextEditor id="profile-about" value={about} onChange={setAbout} maxTextLength={500}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')} imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
                placeholder={t('RICH_TEXT_PLACEHOLDER')} />
              <p className="account-card__description">{t('PROFILE_ABOUT_MAX_LENGTH')}</p>
            </div>
            {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
          </div>
          <PreferenceSelector title={t('PROFILE_TYPE_LABEL')}>
            <PreferenceOption label={t('PROFILE_TYPE_SOCIAL')} description={t('PROFILE_TYPE_SOCIAL_DESCRIPTION')} isSelected={type === 'social'} onSelect={() => setType('social')} />
            <PreferenceOption label={t('PROFILE_TYPE_RP')} description={t('PROFILE_TYPE_RP_DESCRIPTION')} isSelected={type === 'rp'} onSelect={() => setType('rp')} />
            <PreferenceOption label={t('PROFILE_TYPE_BUSINESS')} description={t('PROFILE_TYPE_BUSINESS_DESCRIPTION')} isSelected={type === 'business'} onSelect={() => setType('business')} />
          </PreferenceSelector>
          <div className="entity-form-page__actions">
            <Button type="button" variation="secondary" onClick={() => navigate(user?.profiles.length ? ROUTES.home : ROUTES.gettingStarted)}>{t('ACTION_CANCEL')}</Button>
            <Button type="submit" disabled={createProfileMutation.isPending}>{createProfileMutation.isPending ? t('AUTH_SUBMITTING') : t('CREATE_PROFILE_ACTION')}</Button>
          </div>
        </form>
      </section>
    </main>
  )
}

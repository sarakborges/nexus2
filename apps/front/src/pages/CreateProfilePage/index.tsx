import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import type { Profile, ProfileType } from '@/Models/Profile.model'
import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createUserProfile, getProfileByUrl, updateUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthPage.style.scss'

type ProfileFormProps = {
  profile: Profile | null
}

function ProfileForm({ profile }: ProfileFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const user = useAuthStore(state => state.session?.user)
  const setCurrentProfile = useAuthStore(state => state.setCurrentProfile)
  const isEditing = Boolean(profile)
  const [name, setName] = useState(profile?.name ?? '')
  const [url, setUrl] = useState(profile?.url ?? '')
  const [picture, setPicture] = useState(profile?.picture ?? '')
  const [about, setAbout] = useState(profile?.about ?? '')
  const [type, setType] = useState<ProfileType>(profile?.type ?? 'social')
  const [errorMessage, setErrorMessage] = useState('')

  const profileMutation = useMutation({
    mutationFn: async () => {
      const input = { name, url, picture, about, type }
      if (profile) return updateUserProfile(profile.id, input)

      const created = await createUserProfile(input)
      const isCurrentProfileSet = await setCurrentProfile(created.id)
      if (!isCurrentProfileSet) throw new Error('CURRENT_PROFILE_UPDATE_FAILED')
      return created
    },
    onSuccess: async savedProfile => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(savedProfile.url), savedProfile)
      if (profile && profile.url !== savedProfile.url) {
        queryClient.removeQueries({ queryKey: queryKeys.profiles.byUrl(profile.url), exact: true })
      }
      queryClient.setQueryData(queryKeys.auth.session, useAuthStore.getState().session)
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
    }
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!user) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }

    try {
      const savedProfile = await profileMutation.mutateAsync()
      navigate(`${ROUTES.profile}/${savedProfile.url}`, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'PROFILE_URL_ALREADY_IN_USE'
        ? 'PROFILE_ERROR_URL_TAKEN'
        : code === 'INVALID_PROFILE'
          ? 'PROFILE_ERROR_INVALID'
          : isEditing
            ? 'PROFILE_ERROR_UPDATE'
            : 'PROFILE_ERROR_GENERIC'
      setErrorMessage(t(key))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="profile-form-title">
        <div>
          <h1 className="auth-card__title" id="profile-form-title">
            {t(isEditing ? 'PROFILE_EDIT_TITLE' : 'CREATE_PROFILE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t(isEditing ? 'PROFILE_EDIT_DESCRIPTION' : 'CREATE_PROFILE_DESCRIPTION')}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="profile-name" label={t('PROFILE_NAME_LABEL')} type="text" autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
          <FormField id="profile-url" label={t('PROFILE_URL_LABEL')} type="text" placeholder="sara-borges" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
          <div className="form-field">
            <Label htmlFor="profile-type">{t('PROFILE_TYPE_LABEL')}</Label>
            <select className="input" id="profile-type" value={type} onChange={event => setType(event.target.value as ProfileType)} required>
              <option value="social">{t('PROFILE_TYPE_SOCIAL')}</option>
              <option value="rp">{t('PROFILE_TYPE_RP')}</option>
              <option value="business">{t('PROFILE_TYPE_BUSINESS')}</option>
            </select>
          </div>
          <AvatarUploadField
            label={t('PROFILE_PICTURE_LABEL')}
            value={picture}
            purpose="profile-avatar"
            targetId={profile?.id}
            onChange={setPicture}
            selectLabel={t('UPLOAD_SELECT_IMAGE')}
            changeLabel={t('UPLOAD_CHANGE_IMAGE')}
            removeLabel={t('UPLOAD_REMOVE_IMAGE')}
            uploadingLabel={t('UPLOAD_IN_PROGRESS')}
            errorLabel={t('UPLOAD_FAILED')}
            emptyLabel={t('UPLOAD_EMPTY')}
          />
          <div className="form-field">
            <Label id="profile-about-label" htmlFor="profile-about">{t('PROFILE_ABOUT_LABEL')}</Label>
            <RichTextEditor
              id="profile-about"
              value={about}
              onChange={setAbout}
              maxTextLength={500}
              imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
              imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
              onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
              placeholder={t('RICH_TEXT_PLACEHOLDER')}
            />
            <p className="account-card__description">{t('PROFILE_ABOUT_MAX_LENGTH')}</p>
          </div>
          {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
          <Button type="submit" disabled={profileMutation.isPending}>
            {profileMutation.isPending
              ? t('AUTH_SUBMITTING')
              : t(isEditing ? 'PROFILE_EDIT_ACTION' : 'CREATE_PROFILE_ACTION')}
          </Button>
        </form>
      </section>
    </main>
  )
}

export function CreateProfilePage() {
  const { url } = useParams<{ url: string }>()
  const normalizedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const isEditing = Boolean(normalizedUrl)
  const user = useAuthStore(state => state.session?.user)
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(normalizedUrl),
    queryFn: () => getProfileByUrl(normalizedUrl),
    enabled: isEditing
  })

  if (!isEditing) return <ProfileForm profile={null} />
  if (profileQuery.isLoading) {
    return <main className="auth-page"><section className="auth-card"><RequestState isLoading /></section></main>
  }
  if (profileQuery.isError) {
    return <main className="auth-page"><section className="auth-card"><RequestState isError onRetry={() => void profileQuery.refetch()} /></section></main>
  }
  const profile = profileQuery.data
  if (!profile || !user?.profiles.includes(profile.id)) return <NotFoundPage />

  return <ProfileForm key={profile.id} profile={profile} />
}

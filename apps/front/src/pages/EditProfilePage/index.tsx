import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { getApiErrorCode } from '@/Services/Http/api'
import { getProfileByUrl, updateUserProfile } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { NotFoundPage } from '@/pages/NotFoundPage'

import '../AuthPage.style.scss'

import type { ProfileForm } from './EditProfilePage.types'

export function EditProfilePage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.session)
  const showToast = useToastStore((state) => state.showToast)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUrl(requestedUrl),
    queryFn: () => getProfileByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const profile = profileQuery.data
  const typeCompatibility = useProfileTypeCompatibility(
    profile?.type ?? 'social'
  )
  const initializedProfileId = useRef<string | null>(null)
  const [form, setForm] = useState<ProfileForm | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!profile || initializedProfileId.current === profile.id) return
    initializedProfileId.current = profile.id
    setForm({ name: profile.name, url: profile.url, about: profile.about })
  }, [profile])

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!profile || !form) throw new Error('PROFILE_NOT_READY')
      return updateUserProfile(profile.id, {
        name: form.name,
        url: form.url || undefined,
        picture: profile.picture,
        about: form.about
      })
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(queryKeys.profiles.byUrl(updated.url), updated)
      await queryClient.invalidateQueries({ queryKey: ['profiles'] })
      showToast(t('TOAST_PROFILE_UPDATED'))
      navigate(ROUTES.profile + '/' + updated.url, { replace: true })
    }
  })

  if (!requestedUrl) return <NotFoundPage />
  if (profileQuery.isLoading)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (profileQuery.isError)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isError onRetry={() => void profileQuery.refetch()} />
        </section>
      </main>
    )
  if (!profile || !session?.user.profiles.includes(profile.id))
    return <NotFoundPage />
  if (typeCompatibility.isChecking)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (!typeCompatibility.isCompatible)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <p className="profile-type-notice" role="alert">
            {t('PROFILE_TYPE_MISMATCH_NOTICE')}
          </p>
        </section>
      </main>
    )
  if (!form)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      await updateMutation.mutateAsync()
    } catch (error) {
      const code = getApiErrorCode(error)
      const key =
        code === 'PROFILE_URL_ALREADY_IN_USE'
          ? 'PROFILE_ERROR_URL_TAKEN'
          : code === 'INVALID_PROFILE'
            ? 'PROFILE_ERROR_INVALID'
            : 'PROFILE_UPDATE_ERROR'
      setErrorMessage(t(key))
      showToast(t(key), 'error')
    }
  }

  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby="edit-profile-title"
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id="edit-profile-title">
            {t('PROFILE_EDIT')}
          </h1>
          <p className="auth-card__description">
            {t('PROFILE_EDIT_DESCRIPTION')}
          </p>
        </header>
        <form className="entity-form-page__form" onSubmit={handleSubmit}>
          <div className="entity-form-page__card">
            <AvatarUploadField
              label={t('PROFILE_PICTURE_LABEL')}
              value={profile.picture}
              fallbackName={form.name}
              purpose="profile-avatar"
              targetId={profile.id}
              onChange={(picture) =>
                queryClient.setQueryData<Profile>(
                  queryKeys.profiles.byUrl(profile.url),
                  (current) => (current ? { ...current, picture } : current)
                )
              }
              selectLabel={t('UPLOAD_SELECT_IMAGE')}
              changeLabel={t('UPLOAD_CHANGE_IMAGE')}
              removeLabel={t('UPLOAD_REMOVE_IMAGE')}
              uploadingLabel={t('UPLOAD_IN_PROGRESS')}
              errorLabel={t('UPLOAD_FAILED')}
              emptyLabel={t('UPLOAD_EMPTY')}
            />
            <FormField
              id="profile-name"
              label={t('PROFILE_NAME_LABEL')}
              type="text"
              autoComplete="nickname"
              value={form.name}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, name: event.target.value } : current
                )
              }
              maxLength={80}
              required
            />
            <FormField
              id="profile-url"
              label={t('PROFILE_URL_LABEL')}
              type="text"
              placeholder={t('PROFILE_URL_AUTO_PLACEHOLDER')}
              value={form.url}
              onChange={(event) =>
                setForm((current) =>
                  current ? { ...current, url: event.target.value } : current
                )
              }
              autoComplete="off"
            />
            <p className="account-card__description">
              {t('PROFILE_URL_AUTO_HELP')}
            </p>
            <div className="form-field">
              <Label id="profile-about-label" htmlFor="profile-about">
                {t('PROFILE_ABOUT_LABEL')}
              </Label>
              <RichTextEditor
                id="profile-about"
                value={form.about}
                onChange={(about) =>
                  setForm((current) =>
                    current ? { ...current, about } : current
                  )
                }
                maxTextLength={500}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={(file) =>
                  uploadFile(file, 'editor-image').then((result) => result.url)
                }
                placeholder={t('RICH_TEXT_PLACEHOLDER')}
              />
              <p className="account-card__description">
                {t('PROFILE_ABOUT_MAX_LENGTH')}
              </p>
            </div>
            {errorMessage && (
              <p className="auth-card__error" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
          <div className="entity-form-page__actions">
            <Button
              type="button"
              variation="secondary"
              onClick={() => navigate(ROUTES.profile + '/' + profile.url)}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending
                ? t('AUTH_SUBMITTING')
                : t('PROFILE_UPDATE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

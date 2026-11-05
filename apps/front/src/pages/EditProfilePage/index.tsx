import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { uploadFile } from '@/Services/Uploads'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditProfilePage } from './useEditProfilePage'

import '../AuthPage.style.scss'

export function EditProfilePage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    session,
    profileQuery,
    profile,
    typeCompatibility,
    form,
    errorMessage,
    isSubmitting,
    updateForm,
    updateProfilePicture,
    cancelEdit,
    handleSubmit
  } = useEditProfilePage()

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
                updateProfilePicture(picture)
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
                updateForm({ name: event.target.value })
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
                updateForm({ url: event.target.value })
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
                  updateForm({ about })
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
              onClick={cancelEdit}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('AUTH_SUBMITTING')
                : t('PROFILE_UPDATE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

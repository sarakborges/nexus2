import { RequestState } from '@/Components'
import { ProfileDetailsFields } from '@/Components/Organisms/ProfileDetailsFields'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditProfilePage } from './useEditProfilePage'

import '../AuthPage.style.scss'

export function EditProfilePage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    session,
    isAuthInitialized,
    profileEditPageQuery,
    profile,
    typeCompatibility,
    form,
    errorMessage,
    isSubmitting,
    updateForm,
    uploadEditorImage,
    updateProfilePicture,
    cancelEdit,
    handleSubmit
  } = useEditProfilePage()

  if (!requestedUrl) return <NotFoundPage />
  if (!isAuthInitialized || profileEditPageQuery.isLoading)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (profileEditPageQuery.isError)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState
            isError
            onRetry={() => void profileEditPageQuery.refetch()}
          />
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
          <ProfileDetailsFields
            name={form.name}
            url={form.url}
            picture={profile.picture}
            about={form.about}
            onNameChange={(name) => updateForm({ name })}
            onUrlChange={(url) => updateForm({ url })}
            onPictureChange={updateProfilePicture}
            onAboutChange={(about) => updateForm({ about })}
            targetId={profile.id}
            onUploadImage={uploadEditorImage}
          />
          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="entity-form-page__actions">
            <Button
              type="button"
              variation="secondary"
              onClick={cancelEdit}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting || form.about.length > 8000}>
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

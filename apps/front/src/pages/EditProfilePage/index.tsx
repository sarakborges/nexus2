import { EntityEditPageLayout } from '@/Components/Organisms/EntityEditPageLayout'
import { ProfileDetailsFields } from '@/Components/Organisms/ProfileDetailsFields'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditProfilePage } from './useEditProfilePage'


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

  return (
    <EntityEditPageLayout
      title={t('PROFILE_EDIT')}
      description={t('PROFILE_EDIT_DESCRIPTION')}
      titleId="edit-profile-title"
      hasValidRequest={Boolean(requestedUrl)}
      isLoading={!isAuthInitialized || profileEditPageQuery.isLoading}
      isError={profileEditPageQuery.isError}
      onRetry={() => void profileEditPageQuery.refetch()}
      isEntityAvailable={Boolean(profile && session?.user.profiles.includes(profile.id))}
      isTypeChecking={typeCompatibility.isChecking}
      isTypeCompatible={typeCompatibility.isCompatible}
      isFormReady={Boolean(form)}
      notFound={<NotFoundPage />}
    >
      {form && profile && (
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
      )}
    </EntityEditPageLayout>
  )
}

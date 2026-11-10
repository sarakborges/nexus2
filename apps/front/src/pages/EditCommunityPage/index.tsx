import { RequestState } from '@/Components'
import { CommunityDetailsFields } from '@/Components/Organisms/CommunityDetailsFields'
import { CommunityPrivacySelector } from '@/Components/Organisms/CommunityPrivacySelector'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditCommunityPage } from './useEditCommunityPage'

import '../AuthPage.style.scss'

export function EditCommunityPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    communityEditPageQuery,
    community,
    typeCompatibility,
    ownerProfileId,
    isAuthInitialized,
    form,
    errorMessage,
    isSubmitting,
    updateForm,
    uploadEditorImage,
    updateCommunityPicture,
    cancelEdit,
    handleSubmit
  } = useEditCommunityPage()

  if (!requestedUrl) return <NotFoundPage />
  if (!isAuthInitialized || communityEditPageQuery.isLoading)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (communityEditPageQuery.isError)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState
            isError
            onRetry={() => void communityEditPageQuery.refetch()}
          />
        </section>
      </main>
    )
  if (!community || !ownerProfileId || !form) return <NotFoundPage />
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

  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby="edit-community-title"
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id="edit-community-title">
            {t('COMMUNITY_EDIT')}
          </h1>
          <p className="auth-card__description">
            {t('COMMUNITY_EDIT_DESCRIPTION')}
          </p>
        </header>
        <form className="entity-form-page__form" onSubmit={handleSubmit}>
          <CommunityDetailsFields
            name={form.name}
            url={form.url}
            picture={community.picture}
            about={form.about}
            onNameChange={(name) => updateForm({ name })}
            onUrlChange={(url) => updateForm({ url })}
            onPictureChange={updateCommunityPicture}
            onAboutChange={(about) => updateForm({ about })}
            targetId={community.id}
            actorProfileId={ownerProfileId}
            onUploadImage={uploadEditorImage}
          />
          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}
          <CommunityPrivacySelector
            value={form.privacy}
            onChange={(privacy) => updateForm({ privacy })}
          />
          <div className="entity-form-page__actions">
            <Button type="button" variation="secondary" onClick={cancelEdit}>
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting || form.about.length > 8000}>
              {isSubmitting
                ? t('AUTH_SUBMITTING')
                : t('COMMUNITY_UPDATE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

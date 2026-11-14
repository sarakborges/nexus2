import { CommunityDetailsFields } from '@/Components/Organisms/CommunityDetailsFields'
import { CommunityPrivacySelector } from '@/Components/Organisms/CommunityPrivacySelector'
import { EntityEditPageLayout } from '@/Components/Organisms/EntityEditPageLayout'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditCommunityPage } from './useEditCommunityPage'


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

  return (
    <EntityEditPageLayout
      title={t('COMMUNITY_EDIT')}
      description={t('COMMUNITY_EDIT_DESCRIPTION')}
      titleId="edit-community-title"
      hasValidRequest={Boolean(requestedUrl)}
      isLoading={!isAuthInitialized || communityEditPageQuery.isLoading}
      isError={communityEditPageQuery.isError}
      onRetry={() => void communityEditPageQuery.refetch()}
      isEntityAvailable={Boolean(community && ownerProfileId)}
      isTypeChecking={typeCompatibility.isChecking}
      isTypeCompatible={typeCompatibility.isCompatible}
      isFormReady={Boolean(form)}
      notFound={<NotFoundPage />}
    >
      {form && community && ownerProfileId && (
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
      )}
    </EntityEditPageLayout>
  )
}

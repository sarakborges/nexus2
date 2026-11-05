import { RequestState, AvatarUploadField, RichTextEditor } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { uploadFile } from '@/Services/Uploads'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { useEditCommunityPage } from './useEditCommunityPage'

import '../AuthPage.style.scss'

export function EditCommunityPage() {
  const { t } = useTranslations()
  const {
    requestedUrl,
    communityQuery,
    community,
    typeCompatibility,
    relationshipsQuery,
    ownerProfileId,
    form,
    errorMessage,
    isSubmitting,
    updateForm,
    updateCommunityPicture,
    cancelEdit,
    handleSubmit
  } = useEditCommunityPage()

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading || relationshipsQuery.isLoading)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  if (communityQuery.isError)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isError onRetry={() => void communityQuery.refetch()} />
        </section>
      </main>
    )
  if (relationshipsQuery.isError)
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState
            isError
            onRetry={() => void relationshipsQuery.refetch()}
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
          <div className="entity-form-page__card">
            <AvatarUploadField
              label={t('COMMUNITY_PICTURE_LABEL')}
              value={community.picture}
              fallbackName={form.name}
              purpose="community-avatar"
              targetId={community.id}
              actorProfileId={ownerProfileId}
              onChange={updateCommunityPicture}
              selectLabel={t('UPLOAD_SELECT_IMAGE')}
              changeLabel={t('UPLOAD_CHANGE_IMAGE')}
              removeLabel={t('UPLOAD_REMOVE_IMAGE')}
              uploadingLabel={t('UPLOAD_IN_PROGRESS')}
              errorLabel={t('UPLOAD_FAILED')}
              emptyLabel={t('UPLOAD_EMPTY')}
            />
            <FormField
              id="community-name"
              label={t('COMMUNITY_NAME_LABEL')}
              type="text"
              value={form.name}
              onChange={(event) =>
                updateForm({ name: event.target.value })
              }
              maxLength={80}
              required
            />
            <FormField
              id="community-url"
              label={t('COMMUNITY_URL_LABEL')}
              type="text"
              placeholder={t('COMMUNITY_URL_AUTO_PLACEHOLDER')}
              value={form.url}
              onChange={(event) =>
                updateForm({ url: event.target.value })
              }
              autoComplete="off"
            />
            <p className="account-card__description">
              {t('COMMUNITY_URL_AUTO_HELP')}
            </p>
            <div className="form-field">
              <Label id="community-about-label" htmlFor="community-about">
                {t('COMMUNITY_ABOUT_LABEL')}
              </Label>
              <RichTextEditor
                id="community-about"
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
                {t('COMMUNITY_ABOUT_MAX_LENGTH')}
              </p>
            </div>
            {errorMessage && (
              <p className="auth-card__error" role="alert">
                {errorMessage}
              </p>
            )}
          </div>
          <PreferenceSelector title={t('COMMUNITY_PRIVACY_LABEL')}>
            <PreferenceOption
              label={t('COMMUNITY_PRIVACY_PUBLIC')}
              description={t('COMMUNITY_PRIVACY_PUBLIC_DESCRIPTION')}
              isSelected={form.privacy === 'public'}
              onSelect={() =>
                updateForm({ privacy: 'public' })
              }
            />
            <PreferenceOption
              label={t('COMMUNITY_PRIVACY_PRIVATE')}
              description={t('COMMUNITY_PRIVACY_PRIVATE_DESCRIPTION')}
              isSelected={form.privacy === 'private'}
              onSelect={() =>
                updateForm({ privacy: 'private' })
              }
            />
            <PreferenceOption
              label={t('COMMUNITY_PRIVACY_UNLISTED')}
              description={t('COMMUNITY_PRIVACY_UNLISTED_DESCRIPTION')}
              isSelected={form.privacy === 'unlisted'}
              onSelect={() =>
                updateForm({ privacy: 'unlisted' })
              }
            />
          </PreferenceSelector>
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
                : t('COMMUNITY_UPDATE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
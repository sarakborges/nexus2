import { AvatarUploadField, RichTextEditor } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCreateCommunityPage } from './useCreateCommunityPage'

import '../AuthPage.style.scss'

export function CreateCommunityPage() {
  const { t } = useTranslations()
  const {
    name,
    setName,
    url,
    setUrl,
    picture,
    setPicture,
    about,
    setAbout,
    privacy,
    setPrivacy,
    errorMessage,
    isSubmitting,
    handleSubmit,
    handleCancel
  } = useCreateCommunityPage()

  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby="create-community-title"
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id="create-community-title">
            {t('COMMUNITY_CREATE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('COMMUNITY_CREATE_DESCRIPTION')}
          </p>
        </header>
        <form className="entity-form-page__form" onSubmit={handleSubmit}>
          <div className="entity-form-page__card">
            <FormField
              id="community-name"
              label={t('COMMUNITY_NAME_LABEL')}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
            <FormField
              id="community-url"
              label={t('COMMUNITY_URL_LABEL')}
              type="text"
              placeholder={t('COMMUNITY_URL_AUTO_PLACEHOLDER')}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoComplete="off"
            />
            <p className="account-card__description">
              {t('COMMUNITY_URL_AUTO_HELP')}
            </p>
            <AvatarUploadField
              label={t('COMMUNITY_PICTURE_LABEL')}
              value={picture}
              fallbackName={name}
              purpose="community-avatar"
              onChange={setPicture}
              selectLabel={t('UPLOAD_SELECT_IMAGE')}
              changeLabel={t('UPLOAD_CHANGE_IMAGE')}
              removeLabel={t('UPLOAD_REMOVE_IMAGE')}
              uploadingLabel={t('UPLOAD_IN_PROGRESS')}
              errorLabel={t('UPLOAD_FAILED')}
              emptyLabel={t('UPLOAD_EMPTY')}
            />
            <div className="form-field">
              <Label id="community-about-label" htmlFor="community-about">
                {t('COMMUNITY_ABOUT_LABEL')}
              </Label>
              <RichTextEditor
                id="community-about"
                value={about}
                onChange={setAbout}
                maxTextLength={500}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={uploadEditorImage}
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
              isSelected={privacy === 'public'}
              onSelect={() => setPrivacy('public')}
            />
            <PreferenceOption
              label={t('COMMUNITY_PRIVACY_PRIVATE')}
              description={t('COMMUNITY_PRIVACY_PRIVATE_DESCRIPTION')}
              isSelected={privacy === 'private'}
              onSelect={() => setPrivacy('private')}
            />
            <PreferenceOption
              label={t('COMMUNITY_PRIVACY_UNLISTED')}
              description={t('COMMUNITY_PRIVACY_UNLISTED_DESCRIPTION')}
              isSelected={privacy === 'unlisted'}
              onSelect={() => setPrivacy('unlisted')}
            />
          </PreferenceSelector>

          <div className="entity-form-page__actions">
            <Button
              type="button"
              variation="secondary"
              onClick={handleCancel}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('AUTH_SUBMITTING')
                : t('COMMUNITY_CREATE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

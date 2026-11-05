import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { uploadFile } from '@/Services/Uploads'
import { useCreateProfilePage } from './useCreateProfilePage'

import '../AuthPage.style.scss'

export function CreateProfilePage() {
  const { t } = useTranslations()
  const {
    isAuthInitialized,
    name,
    setName,
    url,
    setUrl,
    picture,
    setPicture,
    about,
    setAbout,
    type,
    setType,
    errorMessage,
    isSubmitting,
    handleSubmit
  } = useCreateProfilePage()

  if (!isAuthInitialized) {
    return (
      <main className="auth-page">
        <section className="entity-form-page">
          <RequestState isLoading />
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby="create-profile-title"
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id="create-profile-title">
            {t('CREATE_PROFILE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t('CREATE_PROFILE_DESCRIPTION')}
          </p>
        </header>
        <form className="entity-form-page__form" onSubmit={handleSubmit}>
          <div className="entity-form-page__card">
            <FormField
              id="profile-name"
              label={t('PROFILE_NAME_LABEL')}
              type="text"
              autoComplete="nickname"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
            />
            <FormField
              id="profile-url"
              label={t('PROFILE_URL_LABEL')}
              type="text"
              placeholder={t('PROFILE_URL_AUTO_PLACEHOLDER')}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoComplete="off"
            />
            <p className="account-card__description">
              {t('PROFILE_URL_AUTO_HELP')}
            </p>
            <AvatarUploadField
              label={t('PROFILE_PICTURE_LABEL')}
              value={picture}
              fallbackName={name}
              purpose="profile-avatar"
              onChange={setPicture}
              selectLabel={t('UPLOAD_SELECT_IMAGE')}
              changeLabel={t('UPLOAD_CHANGE_IMAGE')}
              removeLabel={t('UPLOAD_REMOVE_IMAGE')}
              uploadingLabel={t('UPLOAD_IN_PROGRESS')}
              errorLabel={t('UPLOAD_FAILED')}
              emptyLabel={t('UPLOAD_EMPTY')}
            />
            <div className="form-field">
              <Label id="profile-about-label" htmlFor="profile-about">
                {t('PROFILE_ABOUT_LABEL')}
              </Label>
              <RichTextEditor
                id="profile-about"
                value={about}
                onChange={setAbout}
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
          <PreferenceSelector title={t('PROFILE_TYPE_LABEL')}>
            <PreferenceOption
              label={t('PROFILE_TYPE_SOCIAL')}
              description={t('PROFILE_TYPE_SOCIAL_DESCRIPTION')}
              isSelected={type === 'social'}
              onSelect={() => setType('social')}
            />
            <PreferenceOption
              label={t('PROFILE_TYPE_RP')}
              description={t('PROFILE_TYPE_RP_DESCRIPTION')}
              isSelected={type === 'rp'}
              onSelect={() => setType('rp')}
            />
            <PreferenceOption
              label={t('PROFILE_TYPE_BUSINESS')}
              description={t('PROFILE_TYPE_BUSINESS_DESCRIPTION')}
              isSelected={type === 'business'}
              onSelect={() => setType('business')}
            />
          </PreferenceSelector>
          <div className="entity-form-page__actions">
            <Button
              type="button"
              variation="secondary"
              onClick={() =>
                navigate(
                  user?.profiles.length ? ROUTES.home : ROUTES.gettingStarted
                )
              }
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('AUTH_SUBMITTING')
                : t('CREATE_PROFILE_ACTION')}
            </Button>
          </div>
        </form>
      </section>
    </main>
  )
}

import { CommunityDetailsFields } from '@/Components/Organisms/CommunityDetailsFields'
import { CommunityPrivacySelector } from '@/Components/Organisms/CommunityPrivacySelector'
import { Button } from '@/DesignSystem'
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
    uploadEditorImage,
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
          <CommunityDetailsFields
            name={name}
            url={url}
            picture={picture}
            about={about}
            onNameChange={setName}
            onUrlChange={setUrl}
            onPictureChange={setPicture}
            onAboutChange={setAbout}
            onUploadImage={uploadEditorImage}
          />
          {errorMessage && (
            <p className="auth-card__error" role="alert">
              {errorMessage}
            </p>
          )}
          <CommunityPrivacySelector
            value={privacy}
            onChange={setPrivacy}
          />
          <div className="entity-form-page__actions">
            <Button
              type="button"
              variation="secondary"
              onClick={handleCancel}
            >
              {t('ACTION_CANCEL')}
            </Button>
            <Button type="submit" disabled={isSubmitting || about.length > 8000}>
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

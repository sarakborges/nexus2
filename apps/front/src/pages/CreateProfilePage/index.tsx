import { RequestState } from '@/Components'
import { ProfileDetailsFields } from '@/Components/Organisms/ProfileDetailsFields'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
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
    uploadEditorImage,
    handleSubmit,
    handleCancel
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
          <ProfileDetailsFields
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
              onClick={handleCancel}
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

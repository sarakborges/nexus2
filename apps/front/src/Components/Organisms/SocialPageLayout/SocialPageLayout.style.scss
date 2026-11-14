import { FormErrorMessage } from '@/Components/Molecules/FormErrorMessage'
import { RequestState } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { EntityFormPageLayout, PreferenceSelector, ProfileDetailsFields } from '@/Components/Organisms'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { useCreateProfilePage } from './useCreateProfilePage'


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
      <EntityFormPageLayout>
        <RequestState isLoading />
      </EntityFormPageLayout>
    )
  }

  return (
    <EntityFormPageLayout
      title={t('CREATE_PROFILE_TITLE')}
      description={t('CREATE_PROFILE_DESCRIPTION')}
      titleId="create-profile-title"
    >
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
          <FormErrorMessage>{errorMessage}</FormErrorMessage>
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
          <Button type="submit" disabled={isSubmitting || about.length > 8000}>
            {isSubmitting
              ? t('AUTH_SUBMITTING')
              : t('CREATE_PROFILE_ACTION')}
          </Button>
        </div>
      </form>
    </EntityFormPageLayout>
  )
}

import type { ProfileDetailsFieldsProps } from './ProfileDetailsFields.types'

import { AvatarUploadField } from '@/Components/Molecules/AvatarUploadField'
import { RichTextEditor } from '@/Components/Molecules/RichTextEditor'
import { FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

export function ProfileDetailsFields({
  name,
  url,
  picture,
  about,
  onNameChange,
  onUrlChange,
  onPictureChange,
  onAboutChange,
  targetId,
  onUploadImage
}: ProfileDetailsFieldsProps) {
  const { t } = useTranslations()

  return (
    <div className="entity-form-page__card">
      <AvatarUploadField
        label={t('PROFILE_PICTURE_LABEL')}
        value={picture}
        fallbackName={name}
        purpose="profile-avatar"
        targetId={targetId}
        onChange={onPictureChange}
        selectLabel={t('UPLOAD_SELECT_IMAGE')}
        changeLabel={t('UPLOAD_CHANGE_IMAGE')}
        removeLabel={t('UPLOAD_REMOVE_IMAGE')}
        uploadingLabel={t('UPLOAD_IN_PROGRESS')}
        errorLabel={t('UPLOAD_FAILED')}
        emptyLabel={t('UPLOAD_EMPTY')}
      />
      <FormField
        id="profile-name"
        label={t('PROFILE_NAME_LABEL')}
        type="text"
        autoComplete="nickname"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        maxLength={80}
        required
      />
      <FormField
        id="profile-url"
        label={t('PROFILE_URL_LABEL')}
        type="text"
        placeholder={t('PROFILE_URL_AUTO_PLACEHOLDER')}
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        autoComplete="off"
      />
      <p className="account-card__description">
        {t('PROFILE_URL_AUTO_HELP')}
      </p>
      <div className="form-field">
        <Label id="profile-about-label" htmlFor="profile-about">
          {t('PROFILE_ABOUT_LABEL')}
        </Label>
        <RichTextEditor
          id="profile-about"
          value={about}
          onChange={onAboutChange}
          maxTextLength={500}
          imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
          imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
          onUploadImage={onUploadImage}
          placeholder={t('RICH_TEXT_PLACEHOLDER')}
        />
        <p className="account-card__description">
          {t('PROFILE_ABOUT_MAX_LENGTH')}
        </p>
      </div>
    </div>
  )
}

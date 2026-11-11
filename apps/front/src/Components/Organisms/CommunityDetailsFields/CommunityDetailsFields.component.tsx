import type { CommunityDetailsFieldsProps } from './CommunityDetailsFields.types'

import { AvatarUploadField } from '@/Components/Molecules/AvatarUploadField'
import { RichTextEditor } from '@/Components/Molecules/RichTextEditor'
import { FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

export function CommunityDetailsFields({
  name,
  url,
  picture,
  about,
  onNameChange,
  onUrlChange,
  onPictureChange,
  onAboutChange,
  targetId,
  actorProfileId,
  onUploadImage
}: CommunityDetailsFieldsProps) {
  const { t } = useTranslations()

  return (
    <div className="entity-form-page__card">
      <AvatarUploadField
        label={t('COMMUNITY_PICTURE_LABEL')}
        value={picture}
        fallbackName={name}
        purpose="community-avatar"
        targetId={targetId}
        actorProfileId={actorProfileId}
        onChange={onPictureChange}
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
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        maxLength={80}
        required
      />
      <FormField
        id="community-url"
        label={t('COMMUNITY_URL_LABEL')}
        type="text"
        placeholder={t('COMMUNITY_URL_AUTO_PLACEHOLDER')}
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
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
          value={about}
          onChange={onAboutChange}
          maxHtmlLength={8000}
          imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
          imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
          onUploadImage={onUploadImage}
          placeholder={t('RICH_TEXT_PLACEHOLDER')}
        />
      </div>
    </div>
  )
}

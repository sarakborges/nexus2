import type {
  EntityDetailsEntity,
  EntityDetailsFieldConfig,
  EntityDetailsFieldsProps
} from './EntityDetailsFields.types'

import { AvatarUploadField } from '@/Components/Molecules/AvatarUploadField'
import { RichTextEditor } from '@/Components/Molecules/RichTextEditor'
import { FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'

const FIELD_CONFIG: Record<EntityDetailsEntity, EntityDetailsFieldConfig> = {
  profile: {
    avatarLabel: 'PROFILE_PICTURE_LABEL',
    avatarPurpose: 'profile-avatar',
    nameLabel: 'PROFILE_NAME_LABEL',
    urlLabel: 'PROFILE_URL_LABEL',
    urlPlaceholder: 'PROFILE_URL_AUTO_PLACEHOLDER',
    urlHelp: 'PROFILE_URL_AUTO_HELP',
    aboutLabel: 'PROFILE_ABOUT_LABEL',
    aboutMaxLength: 'PROFILE_ABOUT_MAX_LENGTH'
  },
  community: {
    avatarLabel: 'COMMUNITY_PICTURE_LABEL',
    avatarPurpose: 'community-avatar',
    nameLabel: 'COMMUNITY_NAME_LABEL',
    urlLabel: 'COMMUNITY_URL_LABEL',
    urlPlaceholder: 'COMMUNITY_URL_AUTO_PLACEHOLDER',
    urlHelp: 'COMMUNITY_URL_AUTO_HELP',
    aboutLabel: 'COMMUNITY_ABOUT_LABEL',
    aboutMaxLength: 'COMMUNITY_ABOUT_MAX_LENGTH'
  }
}

export function EntityDetailsFields({
  entity,
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
}: EntityDetailsFieldsProps) {
  const { t } = useTranslations()
  const config = FIELD_CONFIG[entity]

  return (
    <div className="entity-form-page__card">
      <AvatarUploadField
        label={t(config.avatarLabel)}
        value={picture}
        fallbackName={name}
        purpose={config.avatarPurpose}
        targetId={targetId}
        actorProfileId={entity === 'community' ? actorProfileId : undefined}
        onChange={onPictureChange}
        selectLabel={t('UPLOAD_SELECT_IMAGE')}
        changeLabel={t('UPLOAD_CHANGE_IMAGE')}
        removeLabel={t('UPLOAD_REMOVE_IMAGE')}
        uploadingLabel={t('UPLOAD_IN_PROGRESS')}
        errorLabel={t('UPLOAD_FAILED')}
        emptyLabel={t('UPLOAD_EMPTY')}
      />
      <FormField
        id={`${entity}-name`}
        label={t(config.nameLabel)}
        type="text"
        autoComplete={entity === 'profile' ? 'nickname' : undefined}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        maxLength={80}
        required
      />
      <FormField
        id={`${entity}-url`}
        label={t(config.urlLabel)}
        type="text"
        placeholder={t(config.urlPlaceholder)}
        value={url}
        onChange={(event) => onUrlChange(event.target.value)}
        autoComplete="off"
      />
      <p className="account-card__description">{t(config.urlHelp)}</p>
      <div className="form-field">
        <Label id={`${entity}-about-label`} htmlFor={`${entity}-about`}>
          {t(config.aboutLabel)}
        </Label>
        <RichTextEditor
          id={`${entity}-about`}
          value={about}
          onChange={onAboutChange}
          maxTextLength={500}
          imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
          imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
          onUploadImage={onUploadImage}
          placeholder={t('RICH_TEXT_PLACEHOLDER')}
        />
        <p className="account-card__description">
          {t(config.aboutMaxLength)}
        </p>
      </div>
    </div>
  )
}

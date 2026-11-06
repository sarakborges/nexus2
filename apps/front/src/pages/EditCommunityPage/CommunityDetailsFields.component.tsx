import { AvatarUploadField, RichTextEditor } from '@/Components'
import { FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityDetailsFieldsProps } from './CommunityDetailsFields.types'

export function CommunityDetailsFields({
  community,
  ownerProfileId,
  form,
  onChange,
  onPictureChange,
  onUploadImage
}: CommunityDetailsFieldsProps) {
  const { t } = useTranslations()

  return (
    <div className="entity-form-page__card">
      <AvatarUploadField
        label={t('COMMUNITY_PICTURE_LABEL')}
        value={community.picture}
        fallbackName={form.name}
        purpose="community-avatar"
        targetId={community.id}
        actorProfileId={ownerProfileId}
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
        value={form.name}
        onChange={(event) => onChange({ name: event.target.value })}
        maxLength={80}
        required
      />
      <FormField
        id="community-url"
        label={t('COMMUNITY_URL_LABEL')}
        type="text"
        placeholder={t('COMMUNITY_URL_AUTO_PLACEHOLDER')}
        value={form.url}
        onChange={(event) => onChange({ url: event.target.value })}
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
          onChange={(about) => onChange({ about })}
          maxTextLength={500}
          imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
          imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
          onUploadImage={onUploadImage}
          placeholder={t('RICH_TEXT_PLACEHOLDER')}
        />
        <p className="account-card__description">
          {t('COMMUNITY_ABOUT_MAX_LENGTH')}
        </p>
      </div>
    </div>
  )
}

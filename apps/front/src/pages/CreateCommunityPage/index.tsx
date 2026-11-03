import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { CommunityPrivacy } from '@nexus/common'
import { AvatarUploadField, RichTextEditor } from '@/Components'
import { PreferenceOption } from '@/Components/Molecules/PreferenceOption'
import { PreferenceSelector } from '@/Components/Organisms/PreferenceSelector'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createCommunity } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import '../AuthPage.style.scss'

export function CreateCommunityPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const ownerProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore(state => state.showToast)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [privacy, setPrivacy] = useState<CommunityPrivacy>('public')
  const [errorMessage, setErrorMessage] = useState('')
  const createCommunityMutation = useMutation({
    mutationFn: () => createCommunity({ name, url, picture, about, privacy }, ownerProfileId!),
    onSuccess: async community => {
      queryClient.setQueryData(queryKeys.communities.byUrl(community.url), community)
      showToast(t('TOAST_COMMUNITY_CREATED'))
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities', 'list'] }),
        ...(ownerProfileId ? [queryClient.invalidateQueries({ queryKey: ['communities', 'by-profile', ownerProfileId] })] : [])
      ])
    }
  })
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!session) { navigate(ROUTES.signIn, { replace: true }); return }
    if (!ownerProfileId) { navigate(ROUTES.createProfile, { replace: true }); return }
    try {
      const community = await createCommunityMutation.mutateAsync()
      navigate(`${ROUTES.community}/${community.url}`, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'COMMUNITY_URL_ALREADY_IN_USE' ? 'COMMUNITY_ERROR_URL_TAKEN' : code === 'INVALID_COMMUNITY' ? 'COMMUNITY_ERROR_INVALID' : code === 'OWNER_PROFILE_REQUIRED' ? 'COMMUNITY_ERROR_OWNER_REQUIRED' : 'COMMUNITY_ERROR_GENERIC'
      setErrorMessage(t(key))
    }
  }
  return (
    <main className="auth-page"><section className="auth-card auth-card--wide" aria-labelledby="create-community-title">
      <div><h1 className="auth-card__title" id="create-community-title">{t('COMMUNITY_CREATE_TITLE')}</h1><p className="auth-card__description">{t('COMMUNITY_CREATE_DESCRIPTION')}</p></div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField id="community-name" label={t('COMMUNITY_NAME_LABEL')} type="text" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
        <FormField id="community-url" label={t('COMMUNITY_URL_LABEL')} type="text" placeholder="community-name" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
        <PreferenceSelector title={t('COMMUNITY_PRIVACY_LABEL')}>
          <PreferenceOption label={t('COMMUNITY_PRIVACY_PUBLIC')} description={t('COMMUNITY_PRIVACY_PUBLIC_DESCRIPTION')} isSelected={privacy === 'public'} onSelect={() => setPrivacy('public')} />
          <PreferenceOption label={t('COMMUNITY_PRIVACY_PRIVATE')} description={t('COMMUNITY_PRIVACY_PRIVATE_DESCRIPTION')} isSelected={privacy === 'private'} onSelect={() => setPrivacy('private')} />
          <PreferenceOption label={t('COMMUNITY_PRIVACY_UNLISTED')} description={t('COMMUNITY_PRIVACY_UNLISTED_DESCRIPTION')} isSelected={privacy === 'unlisted'} onSelect={() => setPrivacy('unlisted')} />
        </PreferenceSelector>
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
          <Label id="community-about-label" htmlFor="community-about">{t('COMMUNITY_ABOUT_LABEL')}</Label>
          <RichTextEditor
            id="community-about"
            value={about}
            onChange={setAbout}
            maxTextLength={500}
            imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
            imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
            onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
            placeholder={t('RICH_TEXT_PLACEHOLDER')}
          />
          <p className="account-card__description">{t('COMMUNITY_ABOUT_MAX_LENGTH')}</p>
        </div>
        {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
        <Button type="submit" disabled={createCommunityMutation.isPending}>{createCommunityMutation.isPending ? t('AUTH_SUBMITTING') : t('COMMUNITY_CREATE_ACTION')}</Button>
      </form>
    </section></main>
  )
}

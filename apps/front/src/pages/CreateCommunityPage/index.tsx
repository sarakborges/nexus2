import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import type { ProfileType } from '@/Models/Profile.model'
import { RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createCommunity } from '@/Services/Community'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import '../AuthPage.style.scss'

export function CreateCommunityPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const ownerProfileId = session?.user.currentProfile ?? null
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')
  const [type, setType] = useState<ProfileType>('social')
  const [errorMessage, setErrorMessage] = useState('')
  const createCommunityMutation = useMutation({
    mutationFn: () => createCommunity({ name, url, picture, about, type }, ownerProfileId!),
    onSuccess: async community => {
      queryClient.setQueryData(queryKeys.communities.byUrl(community.url), community)
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
    <main className="auth-page"><section className="auth-card" aria-labelledby="create-community-title">
      <div><h1 className="auth-card__title" id="create-community-title">{t('COMMUNITY_CREATE_TITLE')}</h1><p className="auth-card__description">{t('COMMUNITY_CREATE_DESCRIPTION')}</p></div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <FormField id="community-name" label={t('COMMUNITY_NAME_LABEL')} type="text" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
        <FormField id="community-url" label={t('COMMUNITY_URL_LABEL')} type="text" placeholder="community-name" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
        <div className="form-field"><Label htmlFor="community-type">{t('PROFILE_TYPE_LABEL')}</Label><select className="input" id="community-type" value={type} onChange={event => setType(event.target.value as ProfileType)} required><option value="social">{t('PROFILE_TYPE_SOCIAL')}</option><option value="rp">{t('PROFILE_TYPE_RP')}</option><option value="business">{t('PROFILE_TYPE_BUSINESS')}</option></select></div>
        <FormField id="community-picture" label={t('COMMUNITY_PICTURE_LABEL')} type="url" placeholder="https://example.com/image.jpg" value={picture} onChange={event => setPicture(event.target.value)} />
        <div className="form-field">
          <Label htmlFor="community-about">{t('COMMUNITY_ABOUT_LABEL')}</Label>
          <RichTextEditor
            id="community-about"
            value={about}
            onChange={setAbout}
            imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
            imageUrlPrompt={t('RICH_TEXT_IMAGE_URL_PROMPT')}
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

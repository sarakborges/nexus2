import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'
import type { Community } from '@nexus/common'
import type { ProfileType } from '@/Models/Profile.model'
import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { createCommunity, getCommunityByUrl, updateCommunity } from '@/Services/Community'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthPage.style.scss'

type CommunityFormProps = {
  community: Community | null
  ownerProfileId: string | null
}

function CommunityForm({ community, ownerProfileId }: CommunityFormProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const isEditing = Boolean(community)
  const [name, setName] = useState(community?.name ?? '')
  const [url, setUrl] = useState(community?.url ?? '')
  const [picture, setPicture] = useState(community?.picture ?? '')
  const [about, setAbout] = useState(community?.about ?? '')
  const [type, setType] = useState<ProfileType>(community?.type ?? 'social')
  const [errorMessage, setErrorMessage] = useState('')

  const communityMutation = useMutation({
    mutationFn: () => {
      const input = { name, url, picture, about, type }
      if (community) {
        if (!ownerProfileId) throw new Error('COMMUNITY_OWNER_REQUIRED')
        return updateCommunity(community.id, input, ownerProfileId)
      }
      if (!currentProfileId) throw new Error('COMMUNITY_OWNER_REQUIRED')
      return createCommunity(input, currentProfileId)
    },
    onSuccess: async savedCommunity => {
      queryClient.setQueryData(queryKeys.communities.byUrl(savedCommunity.url), savedCommunity)
      if (community && community.url !== savedCommunity.url) {
        queryClient.removeQueries({ queryKey: queryKeys.communities.byUrl(community.url), exact: true })
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['communities', 'list'] }),
        ...(ownerProfileId ? [queryClient.invalidateQueries({ queryKey: ['communities', 'by-profile', ownerProfileId] })] : [])
      ])
    }
  })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (!session) {
      navigate(ROUTES.signIn, { replace: true })
      return
    }
    if (!isEditing && !currentProfileId) {
      navigate(ROUTES.createProfile, { replace: true })
      return
    }
    if (isEditing && !ownerProfileId) return

    try {
      const savedCommunity = await communityMutation.mutateAsync()
      navigate(`${ROUTES.community}/${savedCommunity.url}`, { replace: true })
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'COMMUNITY_URL_ALREADY_IN_USE'
        ? 'COMMUNITY_ERROR_URL_TAKEN'
        : code === 'INVALID_COMMUNITY'
          ? 'COMMUNITY_ERROR_INVALID'
          : code === 'OWNER_PROFILE_REQUIRED' || code === 'COMMUNITY_OWNER_REQUIRED'
            ? 'COMMUNITY_ERROR_OWNER_REQUIRED'
            : isEditing
              ? 'COMMUNITY_ERROR_UPDATE'
              : 'COMMUNITY_ERROR_GENERIC'
      setErrorMessage(t(key))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="community-form-title">
        <div>
          <h1 className="auth-card__title" id="community-form-title">
            {t(isEditing ? 'COMMUNITY_EDIT_TITLE' : 'COMMUNITY_CREATE_TITLE')}
          </h1>
          <p className="auth-card__description">
            {t(isEditing ? 'COMMUNITY_EDIT_DESCRIPTION' : 'COMMUNITY_CREATE_DESCRIPTION')}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="community-name" label={t('COMMUNITY_NAME_LABEL')} type="text" value={name} onChange={event => setName(event.target.value)} maxLength={80} required />
          <FormField id="community-url" label={t('COMMUNITY_URL_LABEL')} type="text" placeholder="community-name" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={url} onChange={event => setUrl(event.target.value)} required />
          <div className="form-field">
            <Label htmlFor="community-type">{t('PROFILE_TYPE_LABEL')}</Label>
            <select className="input" id="community-type" value={type} onChange={event => setType(event.target.value as ProfileType)} required>
              <option value="social">{t('PROFILE_TYPE_SOCIAL')}</option>
              <option value="rp">{t('PROFILE_TYPE_RP')}</option>
              <option value="business">{t('PROFILE_TYPE_BUSINESS')}</option>
            </select>
          </div>
          <AvatarUploadField
            label={t('COMMUNITY_PICTURE_LABEL')}
            value={picture}
            purpose="community-avatar"
            targetId={community?.id}
            actorProfileId={ownerProfileId ?? undefined}
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
          <Button type="submit" disabled={communityMutation.isPending}>
            {communityMutation.isPending
              ? t('AUTH_SUBMITTING')
              : t(isEditing ? 'COMMUNITY_EDIT_ACTION' : 'COMMUNITY_CREATE_ACTION')}
          </Button>
        </form>
      </section>
    </main>
  )
}

export function CreateCommunityPage() {
  const { url } = useParams<{ url: string }>()
  const normalizedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const isEditing = Boolean(normalizedUrl)
  const userId = useAuthStore(state => state.session?.user.id ?? null)

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalizedUrl),
    queryFn: () => getCommunityByUrl(normalizedUrl),
    enabled: isEditing
  })
  const communityId = communityQuery.data?.id
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(communityId ?? '', userId),
    queryFn: () => getCommunityRelationships(communityId!),
    enabled: Boolean(isEditing && communityId)
  })
  const ownerProfileId = relationshipsQuery.data?.find(record => record.type === 'owner')?.profiles[0] ?? null

  if (!isEditing) return <CommunityForm community={null} ownerProfileId={null} />
  if (communityQuery.isLoading || (communityQuery.data && relationshipsQuery.isLoading)) {
    return <main className="auth-page"><section className="auth-card"><RequestState isLoading /></section></main>
  }
  if (communityQuery.isError) {
    return <main className="auth-page"><section className="auth-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  }
  if (relationshipsQuery.isError) {
    return <main className="auth-page"><section className="auth-card"><RequestState isError onRetry={() => void relationshipsQuery.refetch()} /></section></main>
  }
  const community = communityQuery.data
  if (!community || !ownerProfileId) return <NotFoundPage />

  return <CommunityForm key={community.id} community={community} ownerProfileId={ownerProfileId} />
}

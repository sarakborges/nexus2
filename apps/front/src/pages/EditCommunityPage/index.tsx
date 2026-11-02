import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import type { Community, CommunityRelationship, ProfileType } from '@nexus/common'
import { AvatarUploadField, RequestState, RichTextEditor } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, FormField, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { getApiErrorCode } from '@/Services/Http/api'
import { getCommunityByUrl, updateCommunity } from '@/Services/Community'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { uploadFile } from '@/Services/Uploads'
import { useAuthStore } from '@/Stores/Auth.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthPage.style.scss'

type CommunityForm = {
  name: string
  url: string
  about: string
  type: ProfileType
}

export function EditCommunityPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore(state => state.session)
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id && session?.user.id)
  })
  const ownerRelationship = relationshipsQuery.data?.find((record: CommunityRelationship) => record.type === 'owner') ?? null
  const ownerProfileId = ownerRelationship?.profiles[0] ?? null
  const initializedCommunityId = useRef<string | null>(null)
  const [form, setForm] = useState<CommunityForm | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!community || initializedCommunityId.current === community.id) return
    initializedCommunityId.current = community.id
    setForm({ name: community.name, url: community.url, about: community.about, type: community.type })
  }, [community])

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!community || !form) throw new Error('COMMUNITY_NOT_READY')
      return updateCommunity(community.id, {
        name: form.name,
        url: form.url,
        picture: community.picture,
        about: form.about,
        type: form.type
      })
    },
    onSuccess: async updated => {
      queryClient.setQueryData(queryKeys.communities.byUrl(updated.url), updated)
      await queryClient.invalidateQueries({ queryKey: ['communities'] })
      navigate(ROUTES.community + '/' + updated.url, { replace: true })
    }
  })

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading || relationshipsQuery.isLoading) {
    return <main className="auth-page"><section className="auth-card"><RequestState isLoading /></section></main>
  }
  if (communityQuery.isError) {
    return <main className="auth-page"><section className="auth-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  }
  if (relationshipsQuery.isError) {
    return <main className="auth-page"><section className="auth-card"><RequestState isError onRetry={() => void relationshipsQuery.refetch()} /></section></main>
  }
  if (!community || !ownerProfileId || !form) return <NotFoundPage />

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      await updateMutation.mutateAsync()
    } catch (error) {
      const code = getApiErrorCode(error)
      const key = code === 'COMMUNITY_URL_ALREADY_IN_USE'
        ? 'COMMUNITY_ERROR_URL_TAKEN'
        : code === 'INVALID_COMMUNITY'
          ? 'COMMUNITY_ERROR_INVALID'
          : 'COMMUNITY_UPDATE_ERROR'
      setErrorMessage(t(key))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="edit-community-title">
        <div>
          <h1 className="auth-card__title" id="edit-community-title">{t('COMMUNITY_EDIT')}</h1>
          <p className="auth-card__description">{t('COMMUNITY_EDIT_DESCRIPTION')}</p>
        </div>
        <AvatarUploadField
          label={t('COMMUNITY_PICTURE_LABEL')}
          value={community.picture}
          purpose="community-avatar"
          targetId={community.id}
          actorProfileId={ownerProfileId}
          onChange={picture => queryClient.setQueryData<Community>(queryKeys.communities.byUrl(community.url), current => current ? { ...current, picture } : current)}
          selectLabel={t('UPLOAD_SELECT_IMAGE')}
          changeLabel={t('UPLOAD_CHANGE_IMAGE')}
          removeLabel={t('UPLOAD_REMOVE_IMAGE')}
          uploadingLabel={t('UPLOAD_IN_PROGRESS')}
          errorLabel={t('UPLOAD_FAILED')}
          emptyLabel={t('UPLOAD_EMPTY')}
        />
        <form className="auth-form" onSubmit={handleSubmit}>
          <FormField id="community-name" label={t('COMMUNITY_NAME_LABEL')} type="text" value={form.name} onChange={event => setForm(current => current ? { ...current, name: event.target.value } : current)} maxLength={80} required />
          <FormField id="community-url" label={t('COMMUNITY_URL_LABEL')} type="text" placeholder="community-name" pattern="[a-zA-Z0-9]+([-][a-zA-Z0-9]+)*" value={form.url} onChange={event => setForm(current => current ? { ...current, url: event.target.value } : current)} required />
          <div className="form-field">
            <Label htmlFor="community-type">{t('PROFILE_TYPE_LABEL')}</Label>
            <select className="input" id="community-type" value={form.type} onChange={event => setForm(current => current ? { ...current, type: event.target.value as ProfileType } : current)} required>
              <option value="social">{t('PROFILE_TYPE_SOCIAL')}</option>
              <option value="rp">{t('PROFILE_TYPE_RP')}</option>
              <option value="business">{t('PROFILE_TYPE_BUSINESS')}</option>
            </select>
          </div>
          <div className="form-field">
            <Label id="community-about-label" htmlFor="community-about">{t('COMMUNITY_ABOUT_LABEL')}</Label>
            <RichTextEditor
              id="community-about"
              value={form.about}
              onChange={about => setForm(current => current ? { ...current, about } : current)}
              maxTextLength={500}
              imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
              imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
              onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
              placeholder={t('RICH_TEXT_PLACEHOLDER')}
            />
            <p className="account-card__description">{t('COMMUNITY_ABOUT_MAX_LENGTH')}</p>
          </div>
          {errorMessage && <p className="auth-card__error" role="alert">{errorMessage}</p>}
          <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? t('AUTH_SUBMITTING') : t('COMMUNITY_UPDATE_ACTION')}</Button>
          <p className="auth-card__footer"><Link to={ROUTES.community + '/' + community.url}>{t('COMMUNITY_BACK_TO_PAGE')}</Link></p>
        </form>
      </section>
    </main>
  )
}

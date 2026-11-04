import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { RelationshipActions, RequestState, RichTextEditor } from '@/Components'
import { CommunitySidebar, SocialPageLayout } from '@/Components/Organisms/SocialPageLayout'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import { uploadFile } from '@/Services/Uploads'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { createCommunityForumTopic } from '@/Services/CommunityForum'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

function hasRichTextContent(value: string): boolean {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').trim()
  return Boolean(text || /<img\\b/i.test(value))
}

export function CreateCommunityForumTopicPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore(state => state.session)
  const isAuthInitialized = useAuthStore(state => state.isInitialized)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore(state => state.showToast)
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id && session?.user.id)
  })
  const ownedProfilesQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(profileIds),
    queryFn: () => getProfilesByIds(profileIds),
    enabled: profileIds.length > 0
  })
  const rolesByProfileId = new Map(
    (relationshipsQuery.data ?? [])
      .filter(record => record.profiles[1] === community?.id)
      .map(record => [record.profiles[0], record.type] as const)
  )
  const eligibleProfiles = (ownedProfilesQuery.data ?? []).filter(profile =>
    profile.type === community?.type && ['owner', 'moderator', 'connection'].includes(rolesByProfileId.get(profile.id) ?? '')
  )
  const forumProfile =
    eligibleProfiles.find(profile => profile.id === currentProfileId) ??
    eligibleProfiles.find(profile => rolesByProfileId.get(profile.id) === 'owner') ??
    eligibleProfiles.find(profile => rolesByProfileId.get(profile.id) === 'moderator') ??
    eligibleProfiles[0] ??
    null

  const createMutation = useMutation({
    mutationFn: () => createCommunityForumTopic(community!.id, forumProfile!.id, title, content),
    onSuccess: async topic => {
      showToast(t('TOAST_FORUM_TOPIC_CREATED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
      navigate(ROUTES.community + '/' + community!.url + '/forum/' + topic.id, { replace: true })
    }
  })
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !hasRichTextContent(content) || !forumProfile) return
    await createMutation.mutateAsync()
  }

  if (!normalized) return <NotFoundPage />
  if (communityQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (communityQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  if (!community) return <NotFoundPage />

  return (
    <SocialPageLayout sidebar={<CommunitySidebar community={community} active="forum" canInteract />}>
      <section className="account-card community-forum">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_NEW_TOPIC')}</h1>
            <p className="account-card__description">{t('FORUM_DESCRIPTION')}</p>
          </div>
          <Link className="account-card__link" to={ROUTES.community + '/' + community.url + '/forum'}>{t('FORUM_BACK')}</Link>
        </header>
        <RequestState
          isLoading={!isAuthInitialized || relationshipsQuery.isLoading || ownedProfilesQuery.isLoading}
          isError={relationshipsQuery.isError || ownedProfilesQuery.isError}
          onRetry={() => {
            void relationshipsQuery.refetch()
            void ownedProfilesQuery.refetch()
          }}
        />
        {!isAuthInitialized || relationshipsQuery.isLoading || ownedProfilesQuery.isLoading || relationshipsQuery.isError || ownedProfilesQuery.isError ? null : forumProfile ? (
          <form className="community-forum__composer" onSubmit={submit}>
            <div className="form-field">
              <Label htmlFor="forum-topic-title">{t('FORUM_TOPIC_TITLE')}</Label>
              <input id="forum-topic-title" className="input" value={title} maxLength={140} onChange={event => setTitle(event.target.value)} required />
            </div>
            <div className="form-field">
              <Label id="forum-topic-content-label" htmlFor="forum-topic-content">{t('FORUM_TOPIC_CONTENT')}</Label>
              <RichTextEditor
                id="forum-topic-content"
                value={content}
                onChange={setContent}
                maxTextLength={8000}
                imageButtonLabel={t('RICH_TEXT_INSERT_IMAGE')}
                imageUploadErrorLabel={t('RICH_TEXT_IMAGE_UPLOAD_FAILED')}
                onUploadImage={file => uploadFile(file, 'editor-image').then(result => result.url)}
                placeholder={t('RICH_TEXT_PLACEHOLDER')}
              />
            </div>
            {createMutation.isError && <p className="auth-card__error" role="alert">{t('FORUM_TOPIC_ERROR')}</p>}
            <Button type="submit" disabled={!title.trim() || !hasRichTextContent(content) || createMutation.isPending}>{t('FORUM_PUBLISH_TOPIC')}</Button>
          </form>
        ) : (
          <div className="community-forum__join">
            <p className="account-card__description">{t('FORUM_MEMBERS_ONLY')}</p>
            {session && <RelationshipActions targetId={community.id} targetKind="community" />}
          </div>
        )}
      </section>
    </SocialPageLayout>
  )
}

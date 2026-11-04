import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { Pagination, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { createCommunityForumReply, deleteCommunityForumReply, deleteCommunityForumTopic, getCommunityForumTopic, moderateCommunityForumTopic } from '@/Services/CommunityForum'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import '../CommunityForumPage/CommunityForumPage.style.scss'

export function CommunityForumTopicPage() {
  const { url, topicId } = useParams<{ url: string; topicId: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore(state => state.session)
  const profileIds = session?.user.profiles ?? []
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore(state => state.showToast)
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const { page, pageSize, setPage } = useUrlPagination()
  const [replyContent, setReplyContent] = useState('')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id)
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
  const forumProfileId = forumProfile?.id ?? null
  const currentRole = forumProfileId ? rolesByProfileId.get(forumProfileId) ?? null : null
  const isMember = Boolean(forumProfileId)
  const isStaff = currentRole === 'owner' || currentRole === 'moderator'
  const canInteract = Boolean(forumProfileId)
  const topicQuery = useQuery({
    queryKey: queryKeys.communityForumTopic(community?.id ?? '', topicId ?? '', page, pageSize),
    queryFn: () => getCommunityForumTopic(community!.id, topicId!, { page, pageSize }),
    enabled: Boolean(community?.id && topicId)
  })
  const detail = topicQuery.data
  const topic = detail?.topic
  const replies = detail?.replies.items ?? []
  const authorIds = useMemo(() => [...new Set([topic?.profileId, ...(detail?.replies.items ?? []).map(reply => reply.profileId)].filter((id): id is string => Boolean(id)))].sort(), [topic?.profileId, detail?.replies.items])
  const authorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(authorIds),
    queryFn: () => getProfilesByIds(authorIds),
    enabled: authorIds.length > 0
  })
  const authorsById = useMemo(() => new Map((authorsQuery.data ?? []).map(profile => [profile.id, profile] as const)), [authorsQuery.data])

  const replyMutation = useMutation({
    mutationFn: () => createCommunityForumReply(community!.id, topicId!, forumProfileId!, replyContent),
    onSuccess: async () => {
      setReplyContent('')
      showToast(t('TOAST_FORUM_REPLY_CREATED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
    }
  })
  const moderationMutation = useMutation({
    mutationFn: (changes: { isPinned?: boolean; isLocked?: boolean }) => moderateCommunityForumTopic(community!.id, topicId!, forumProfileId!, changes),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_TOPIC_UPDATED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
    }
  })
  const deleteTopicMutation = useMutation({
    mutationFn: () => deleteCommunityForumTopic(community!.id, topicId!, forumProfileId!),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_CONTENT_DELETED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
      navigate(`${ROUTES.community}/${community!.url}/forum`, { replace: true })
    }
  })
  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: string) => deleteCommunityForumReply(community!.id, replyId, forumProfileId!),
    onSuccess: async () => {
      showToast(t('TOAST_FORUM_CONTENT_DELETED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
    }
  })

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!replyContent.trim() || !isMember || !canInteract || topic?.isLocked) return
    await replyMutation.mutateAsync()
  }

  if (!normalized || !topicId) return <NotFoundPage />
  if (communityQuery.isLoading || topicQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (communityQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  if (topicQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void topicQuery.refetch()} /></section></main>
  if (!community || !detail || !topic) return <NotFoundPage />

  const topicAuthor = authorsById.get(topic.profileId)
  const canDeleteTopic = Boolean(canInteract && forumProfileId && (topic.profileId === forumProfileId || isStaff))

  return (
    <main className="account-page">
      <section className="account-card community-forum">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{topic.title}</h1>
            <p className="account-card__description">{t('FORUM_TITLE')} · {community.name}</p>
          </div>
          <Link className="account-card__link" to={`${ROUTES.community}/${community.url}/forum`}>{t('FORUM_BACK')}</Link>
        </header>


        <article className="community-forum__post">
          <header className="community-forum__post-header">
            <span>{topicAuthor ? <Link to={`${ROUTES.profile}/${topicAuthor.url}`}>{topicAuthor.name}</Link> : t('FORUM_UNKNOWN_AUTHOR')}</span>
            <time dateTime={new Date(topic.createdAt).toISOString()}>{new Date(topic.createdAt).toLocaleString()}</time>
          </header>
          <div className="community-forum__post-content rich-text-content" dangerouslySetInnerHTML={{ __html: topic.content }} />
          {(canInteract && (isStaff || topic.profileId === forumProfileId)) && (
            <div className="community-forum__actions">
              {isStaff && <>
                <Button variation="secondary" disabled={moderationMutation.isPending} onClick={() => moderationMutation.mutate({ isPinned: !topic.isPinned })}>{t(topic.isPinned ? 'FORUM_UNPIN' : 'FORUM_PIN')}</Button>
                <Button variation="secondary" disabled={moderationMutation.isPending} onClick={() => moderationMutation.mutate({ isLocked: !topic.isLocked })}>{t(topic.isLocked ? 'FORUM_UNLOCK' : 'FORUM_LOCK')}</Button>
              </>}
              {canDeleteTopic && <Button variation="cancel" disabled={deleteTopicMutation.isPending} onClick={() => deleteTopicMutation.mutate()}>{t('FORUM_DELETE')}</Button>}
            </div>
          )}
          {topic.isLocked && <p className="account-card__description">{t('FORUM_LOCKED')}</p>}
        </article>

        <section className="community-forum__replies">
          <h2>{t('FORUM_REPLIES')} ({detail.replies.totalItems})</h2>
          {canInteract && isMember && !topic.isLocked ? (
            <form className="community-forum__composer" onSubmit={submitReply}>
              <div className="form-field">
                <Label htmlFor="forum-reply-content">{t('FORUM_REPLY')}</Label>
                <textarea id="forum-reply-content" className="input community-forum__textarea" value={replyContent} maxLength={8000} onChange={event => setReplyContent(event.target.value)} rows={4} required />
              </div>
              {replyMutation.isError && <p className="auth-card__error" role="alert">{t('FORUM_TOPIC_ERROR')}</p>}
              <Button type="submit" disabled={!replyContent.trim() || replyMutation.isPending}>{t('FORUM_PUBLISH_REPLY')}</Button>
            </form>
          ) : !isMember && (
            <p className="account-card__description">{t('FORUM_MEMBERS_ONLY')}</p>
          )}
          <RequestState
            isLoading={authorsQuery.isLoading || ownedProfilesQuery.isLoading || relationshipsQuery.isLoading}
            isFetching={topicQuery.isFetching || authorsQuery.isFetching}
            isError={authorsQuery.isError}
            onRetry={() => void authorsQuery.refetch()}
          >
            {replies.map(reply => {
              const author = authorsById.get(reply.profileId)
              const canDelete = Boolean(canInteract && forumProfileId && (reply.profileId === forumProfileId || isStaff))
              return (
                <article className="community-forum__reply" key={reply.id}>
                  <header className="community-forum__post-header">
                    <span>{author ? <Link to={`${ROUTES.profile}/${author.url}`}>{author.name}</Link> : t('FORUM_UNKNOWN_AUTHOR')}</span>
                    <time dateTime={new Date(reply.createdAt).toISOString()}>{new Date(reply.createdAt).toLocaleString()}</time>
                  </header>
                  <div className="community-forum__post-content rich-text-content" dangerouslySetInnerHTML={{ __html: reply.content }} />
                  {canDelete && <div className="community-forum__actions"><Button variation="cancel" disabled={deleteReplyMutation.isPending} onClick={() => deleteReplyMutation.mutate(reply.id)}>{t('FORUM_DELETE')}</Button></div>}
                </article>
              )
            })}
          </RequestState>
          <Pagination page={page} pageSize={pageSize} totalItems={detail.replies.totalItems} onPageChange={setPage} />
        </section>
      </section>
    </main>
  )
}

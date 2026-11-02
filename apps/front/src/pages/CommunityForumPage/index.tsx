import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { Pagination, RelationshipActions, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { Button, Label } from '@/DesignSystem'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { useUrlPagination } from '@/Hooks/useUrlPagination'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityRelationships } from '@/Services/CommunityRelationship'
import { createCommunityForumTopic, getCommunityForumTopics } from '@/Services/CommunityForum'
import { getProfilesByIds } from '@/Services/Profile'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useToastStore } from '@/Stores/Toast.store'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import './CommunityForumPage.style.scss'

export function CommunityForumPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useAuthStore(state => state.session)
  const currentProfileId = session?.user.currentProfile ?? null
  const showToast = useToastStore(state => state.showToast)
  const normalized = url?.trim().replace(/^@/, '').toLowerCase() ?? ''
  const { page, pageSize, setPage } = useUrlPagination()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(normalized),
    queryFn: () => getCommunityByUrl(normalized),
    enabled: Boolean(normalized)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(community?.type ?? 'social')
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id)
  })
  const currentRole = relationshipsQuery.data?.find(record =>
    record.profiles[0] === currentProfileId && record.profiles[1] === community?.id
  )?.type ?? null
  const isMember = ['owner', 'moderator', 'connection'].includes(currentRole ?? '')
  const canInteract = Boolean(currentProfileId && typeCompatibility.isCompatible && !typeCompatibility.isChecking)
  const topicsQuery = useQuery({
    queryKey: queryKeys.communityForumTopics(community?.id ?? '', page, pageSize),
    queryFn: () => getCommunityForumTopics(community!.id, { page, pageSize }),
    enabled: Boolean(community?.id)
  })
  const topics = topicsQuery.data?.items ?? []
  const authorIds = useMemo(() => [...new Set(topics.map(topic => topic.profileId))].sort(), [topics])
  const authorsQuery = useQuery({
    queryKey: queryKeys.profiles.byIds(authorIds),
    queryFn: () => getProfilesByIds(authorIds),
    enabled: authorIds.length > 0
  })
  const authorsById = useMemo(() => new Map((authorsQuery.data ?? []).map(profile => [profile.id, profile] as const)), [authorsQuery.data])

  const createMutation = useMutation({
    mutationFn: () => createCommunityForumTopic(community!.id, currentProfileId!, title, content),
    onSuccess: async topic => {
      setTitle('')
      setContent('')
      showToast(t('TOAST_FORUM_TOPIC_CREATED'))
      await queryClient.invalidateQueries({ queryKey: ['community-forum', community?.id] })
      navigate(`${ROUTES.community}/${community!.url}/forum/${topic.id}`)
    }
  })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !content.trim() || !isMember || !canInteract) return
    await createMutation.mutateAsync()
  }

  if (!normalized) return <NotFoundPage />
  if (communityQuery.isLoading) return <main className="account-page"><section className="account-card"><RequestState isLoading /></section></main>
  if (communityQuery.isError) return <main className="account-page"><section className="account-card"><RequestState isError onRetry={() => void communityQuery.refetch()} /></section></main>
  if (!community) return <NotFoundPage />

  return (
    <main className="account-page">
      <section className="account-card community-forum">
        <header className="account-card__header">
          <div>
            <h1 className="account-card__title">{t('FORUM_TITLE')}</h1>
            <p className="account-card__description">{t('FORUM_DESCRIPTION')}</p>
          </div>
          <Link className="account-card__link" to={`${ROUTES.community}/${community.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link>
        </header>

        {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}

        <RequestState isLoading={relationshipsQuery.isLoading} isError={relationshipsQuery.isError} onRetry={() => void relationshipsQuery.refetch()} />
        {canInteract && isMember ? (
          <form className="community-forum__composer" onSubmit={submit}>
            <h2>{t('FORUM_NEW_TOPIC')}</h2>
            <div className="form-field">
              <Label htmlFor="forum-topic-title">{t('FORUM_TOPIC_TITLE')}</Label>
              <input id="forum-topic-title" className="input" value={title} maxLength={140} onChange={event => setTitle(event.target.value)} required />
            </div>
            <div className="form-field">
              <Label htmlFor="forum-topic-content">{t('FORUM_TOPIC_CONTENT')}</Label>
              <textarea id="forum-topic-content" className="input community-forum__textarea" value={content} maxLength={8000} onChange={event => setContent(event.target.value)} rows={5} required />
            </div>
            {createMutation.isError && <p className="auth-card__error" role="alert">{t('FORUM_TOPIC_ERROR')}</p>}
            <Button type="submit" disabled={!title.trim() || !content.trim() || createMutation.isPending}>{t('FORUM_PUBLISH_TOPIC')}</Button>
          </form>
        ) : !isMember && (
          <div className="community-forum__join">
            <p className="account-card__description">{t('FORUM_MEMBERS_ONLY')}</p>
            {canInteract && <RelationshipActions targetId={community.id} targetKind="community" />}
          </div>
        )}

        <section className="community-forum__topics">
          <RequestState
            isLoading={topicsQuery.isLoading}
            isFetching={topicsQuery.isFetching}
            isError={topicsQuery.isError}
            isEmpty={topicsQuery.isSuccess && topicsQuery.data.totalItems === 0}
            emptyMessage={t('FORUM_EMPTY')}
            onRetry={() => void topicsQuery.refetch()}
          >
            {topics.map(topic => {
              const author = authorsById.get(topic.profileId)
              return (
                <article className="community-forum__topic" key={topic.id}>
                  <div className="community-forum__topic-main">
                    <div className="community-forum__topic-labels">
                      {topic.isPinned && <span className="community-forum__label">{t('FORUM_PINNED')}</span>}
                      {topic.isLocked && <span className="community-forum__label">{t('FORUM_LOCKED')}</span>}
                    </div>
                    <Link className="community-forum__topic-title" to={`${ROUTES.community}/${community.url}/forum/${topic.id}`}>{topic.title}</Link>
                    <div className="community-forum__topic-meta">
                      <span>{author ? <Link to={`${ROUTES.profile}/${author.url}`}>{author.name}</Link> : t('FORUM_UNKNOWN_AUTHOR')}</span>
                      <time dateTime={new Date(topic.updatedAt).toISOString()}>{new Date(topic.updatedAt).toLocaleString()}</time>
                    </div>
                  </div>
                  <span className="community-forum__reply-count">{topic.replyCount} {t('FORUM_REPLIES')}</span>
                </article>
              )
            })}
          </RequestState>
          <Pagination page={page} pageSize={pageSize} totalItems={topicsQuery.data?.totalItems ?? 0} onPageChange={setPage} />
        </section>

        <p className="account-card__footer"><Link to={`${ROUTES.community}/${community.url}`}>{t('COMMUNITY_BACK_TO_PAGE')}</Link></p>
      </section>
    </main>
  )
}

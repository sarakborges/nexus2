import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { AvatarUploadField, RelationshipActions, RequestState } from '@/Components'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { getCommunityByUrl } from '@/Services/Community'
import { getCommunityMembers, getCommunityRelationships } from '@/Services/CommunityRelationship'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'
import { useProfileTypeCompatibility } from '@/Hooks/useProfileTypeCompatibility'
import { NotFoundPage } from '@/pages/NotFoundPage'
import '../AuthenticatedPage.style.scss'
import './CommunityPage.style.scss'

type PreviewAvatarProps = {
  name: string
  picture: string
}

function PreviewAvatar({ name, picture }: PreviewAvatarProps) {
  return (
    <span className="social-preview-avatar">
      {picture
        ? <img src={picture} alt="" />
        : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>}
    </span>
  )
}

export function CommunityPage() {
  const { url } = useParams<{ url: string }>()
  const { t } = useTranslations()
  const session = useAuthStore(state => state.session)
  const queryClient = useQueryClient()
  const currentProfileId = session?.user.currentProfile ?? null
  const requestedUrl = url?.trim().replace(/^@/, '').toLowerCase() ?? ''

  const communityQuery = useQuery({
    queryKey: queryKeys.communities.byUrl(requestedUrl),
    queryFn: () => getCommunityByUrl(requestedUrl),
    enabled: Boolean(requestedUrl)
  })
  const community = communityQuery.data
  const typeCompatibility = useProfileTypeCompatibility(community?.type ?? 'social')
  const canInteract = !session || (typeCompatibility.isCompatible && !typeCompatibility.isChecking)
  const relationshipsQuery = useQuery({
    queryKey: queryKeys.communityRelationships(community?.id ?? '', session?.user.id ?? null),
    queryFn: () => getCommunityRelationships(community!.id),
    enabled: Boolean(community?.id)
  })
  const membersQuery = useQuery({
    queryKey: queryKeys.communityMembers(community?.id ?? '', 'all', 1, 16, currentProfileId ?? undefined),
    queryFn: () => getCommunityMembers(community!.id, 'all', { page: 1, pageSize: 16 }, currentProfileId ?? undefined),
    enabled: Boolean(community?.id && relationshipsQuery.isSuccess)
  })

  if (!requestedUrl) return <NotFoundPage />
  if (communityQuery.isLoading) {
    return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  }
  if (communityQuery.isError) {
    return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void communityQuery.refetch()} /></div></main>
  }
  if (!community) return <NotFoundPage />
  if (relationshipsQuery.isLoading) {
    return <main className="social-page"><div className="social-page__state"><RequestState isLoading /></div></main>
  }
  if (relationshipsQuery.isError) {
    return <main className="social-page"><div className="social-page__state"><RequestState isError onRetry={() => void relationshipsQuery.refetch()} /></div></main>
  }

  const members = membersQuery.data?.items ?? []
  const memberCount = membersQuery.data?.totalItems
  const avatarManager = canInteract ? relationshipsQuery.data?.find(record => record.type === 'owner' || record.type === 'moderator') : undefined
  const ownerRelationship = canInteract ? relationshipsQuery.data?.find(record => record.type === 'owner') ?? null : null

  return (
    <main className="social-page social-page--community">
      <RequestState isFetching={communityQuery.isFetching || relationshipsQuery.isFetching} />
      {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && <p className="profile-type-notice" role="alert">{t('PROFILE_TYPE_MISMATCH_NOTICE')}</p>}
      <div className="social-page__layout">
        <aside className="social-page__left-column">
          <div className="social-sidebar-card">
          <section className="social-identity">
            {community.picture
              ? <img className="social-identity__picture social-identity__picture--community" src={community.picture} alt={t('COMMUNITY_PICTURE_ALT', { name: community.name })} />
              : <div className="social-identity__picture social-identity__picture--fallback" aria-hidden="true">{community.name.trim().charAt(0).toUpperCase()}</div>}
            <h1 className="social-identity__name">{community.name}</h1>
            {avatarManager && (
              <AvatarUploadField
                label={t('COMMUNITY_PICTURE_LABEL')}
                value={community.picture}
                fallbackName={community.name}
                purpose="community-avatar"
                targetId={community.id}
                actorProfileId={avatarManager.profiles[0]}
                onChange={picture => queryClient.setQueryData(queryKeys.communities.byUrl(community.url), { ...community, picture })}
                selectLabel={t('UPLOAD_SELECT_IMAGE')}
                changeLabel={t('UPLOAD_CHANGE_IMAGE')}
                removeLabel={t('UPLOAD_REMOVE_IMAGE')}
                uploadingLabel={t('UPLOAD_IN_PROGRESS')}
                errorLabel={t('UPLOAD_FAILED')}
                emptyLabel={t('UPLOAD_EMPTY')}
              />
            )}
            {canInteract && <RelationshipActions targetId={community.id} targetKind="community" />}
          </section>

          <nav className="social-side-menu" aria-label={t('COMMUNITY_CREATE_TITLE')}>
            <Link to={ROUTES.community + '/' + community.url} aria-current="page">{t('COMMUNITY_ABOUT_LABEL')}</Link>
            <Link to={ROUTES.community + '/' + community.url + '/members'}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
            <Link to={ROUTES.community + '/' + community.url + '/forum'}>{t('FORUM_TITLE')}</Link>
          </nav>
          {ownerRelationship && (
            <Link className="social-sidebar-card__edit" to={ROUTES.community + '/' + community.url + '/edit'}>
              {t('COMMUNITY_EDIT')}
            </Link>
          )}
          </div>
        </aside>

        <section className="social-page__main-column">
          <article className="social-panel social-panel--about">
            <header className="social-panel__header">
              <div>
                <h2 className="social-panel__title">{t('COMMUNITY_ABOUT_LABEL')}</h2>
              </div>
              <div className="social-community-stat">
                <strong>{memberCount ?? '—'}</strong>
                <span>{t('COMMUNITY_MEMBER_COUNT')}</span>
              </div>
            </header>
            {community.about
              ? <div className="social-panel__body rich-text-content" dangerouslySetInnerHTML={{ __html: community.about }} />
              : <p className="social-panel__body">{t('COMMUNITY_ABOUT_EMPTY')}</p>}
          </article>
        </section>

        <aside className="social-page__right-column">
          <section className="social-preview-panel">
            <header className="social-preview-panel__header">
              <h2>{t('COMMUNITY_MEMBERS_TITLE', { name: community.name })}</h2>
              <div className="social-preview-panel__header-actions">
                <span>{memberCount ?? '—'}</span>
                <Link className="social-preview-panel__all" to={ROUTES.community + '/' + community.url + '/members'}>{t('COMMUNITY_MEMBERS_LINK')}</Link>
              </div>
            </header>
            <RequestState
              isLoading={membersQuery.isLoading}
              isFetching={membersQuery.isFetching}
              isError={membersQuery.isError}
              isEmpty={membersQuery.isSuccess && members.length === 0}
              emptyMessage={t('COMMUNITY_MEMBERS_EMPTY')}
              onRetry={() => void membersQuery.refetch()}
            >
              <div className="social-preview-grid">
                {members.map(member => (
                  <Link className="social-preview-link" key={member.id} to={ROUTES.profile + '/' + member.url} aria-label={member.name} title={member.name}>
                    <PreviewAvatar name={member.name} picture={member.picture} />
                  </Link>
                ))}
              </div>
            </RequestState>
          </section>
        </aside>
      </div>
    </main>
  )
}

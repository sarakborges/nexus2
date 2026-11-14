import { Pagination, RequestState } from '@/Components'
import { CommunityMemberEntry } from '@/Components/Molecules/CommunityMemberEntry'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityPendingMembersSectionProps } from './CommunityPendingMembersSection.types'
import './CommunityPendingMembersSection.style.scss'

export function CommunityPendingMembersSection({
  pageQuery,
  pending,
  totalPending,
  page,
  pageSize,
  onPageChange,
  relationships,
  communityId,
  actorProfileId,
  actorRole,
  isStaff
}: CommunityPendingMembersSectionProps) {
  const { t } = useTranslations()

  return (
    <section className="account-card community-pending-members-section">
      <header className="account-card__header">
        <div>
          <h1 className="account-card__title">
            {t('COMMUNITY_PENDING_REQUESTS')}
          </h1>
          <p className="account-card__description">
            {t('COMMUNITY_PENDING_COUNT', { count: totalPending })}
          </p>
        </div>
      </header>
      <RequestState
        isLoading={pageQuery.isLoading}
        isFetching={pageQuery.isFetching}
        isError={pageQuery.isError}
        isEmpty={pageQuery.isSuccess && totalPending === 0}
        emptyMessage={t('COMMUNITY_MEMBERS_PENDING_EMPTY')}
        onRetry={() => void pageQuery.refetch()}
      >
        <div className="account-card__profile-list account-card__profile-list--grid">
          {pending.map((profile) => (
            <CommunityMemberEntry
              key={profile.id}
              profile={profile}
              relationships={relationships}
              communityId={communityId}
              actorProfileId={actorProfileId}
              actorRole={actorRole}
              isStaff={isStaff}
            />
          ))}
        </div>
      </RequestState>
      {totalPending > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalPending}
          onPageChange={onPageChange}
        />
      )}
    </section>
  )
}

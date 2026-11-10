import { Pagination, RequestState } from '@/Components'
import { CommunityMemberEntry } from './CommunityMemberEntry.component'
import { Button } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityMemberDirectoryProps } from './CommunityMemberDirectory.types'

export function CommunityMemberDirectory({
  pageQuery,
  typeCompatibility,
  tabs,
  activeTab,
  visibleTab,
  onSelectTab,
  members,
  totalMembers,
  page,
  pageSize,
  onPageChange,
  relationships,
  communityId,
  actorProfileId,
  actorRole,
  isStaff
}: CommunityMemberDirectoryProps) {
  const { t } = useTranslations()

  return (
    <section className="account-card">
      <header className="account-card__header">
        <div>
          <h1 className="account-card__title">
            {t('COMMUNITY_MEMBERS_TITLE')}
          </h1>
          <p className="account-card__description">
            {t('COMMUNITY_MEMBERS_DESCRIPTION')}
          </p>
        </div>
      </header>
      {!typeCompatibility.isChecking && !typeCompatibility.isCompatible && (
        <p className="profile-type-notice" role="alert">
          {t('PROFILE_TYPE_MISMATCH_NOTICE')}
        </p>
      )}
      <div className="community-member__tabs" role="tablist">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={visibleTab === tab.id}
            variation={activeTab === tab.id ? 'primary' : 'secondary'}
            onClick={() => onSelectTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      <RequestState
        isLoading={pageQuery.isLoading}
        isFetching={pageQuery.isFetching}
        isError={pageQuery.isError}
        isEmpty={pageQuery.isSuccess && totalMembers === 0}
        emptyMessage={t(
          visibleTab === 'all'
            ? 'COMMUNITY_MEMBERS_EMPTY'
            : visibleTab === 'staff'
              ? 'COMMUNITY_STAFF_EMPTY'
              : 'COMMUNITY_BANNED_EMPTY'
        )}
        onRetry={() => void pageQuery.refetch()}
      >
        <div className="account-card__profile-list account-card__profile-list--grid">
          {members.map((profile) => (
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
      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={totalMembers}
        onPageChange={onPageChange}
      />
    </section>
  )
}

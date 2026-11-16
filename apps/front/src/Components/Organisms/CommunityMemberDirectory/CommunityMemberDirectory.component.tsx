import { ProfileTypeNotice } from '@/Components/Atoms/ProfileTypeNotice'
import { CommunityMemberList } from '@/Components/Organisms/CommunityMemberList'
import { Pagination } from '@/Components/Molecules/Pagination'
import { RequestState } from '@/Components/Molecules/RequestState'
import { Tabs } from '@/DesignSystem'
import { useTranslations } from '@/Hooks/Language'
import type { CommunityMemberDirectoryProps } from './CommunityMemberDirectory.types'

import './CommunityMemberDirectory.style.scss'

export function CommunityMemberDirectory({
  pageQuery,
  typeCompatibility,
  tabs,
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
      <ProfileTypeNotice
        isVisible={!typeCompatibility.isChecking && !typeCompatibility.isCompatible}
        message={t('PROFILE_TYPE_MISMATCH_NOTICE')}
      />
      <Tabs
        className="community-member-directory__tabs"
        ariaLabel={t('COMMUNITY_MEMBERS_TITLE')}
        value={visibleTab}
        onChange={value => onSelectTab(value as typeof visibleTab)}
        options={tabs.map(tab => ({ value: tab.id, label: tab.label }))}
      />
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
        <CommunityMemberList
          members={members}
          relationships={relationships}
          communityId={communityId}
          actorProfileId={actorProfileId}
          actorRole={actorRole}
          isStaff={isStaff}
        />
      </RequestState>
      {totalMembers > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={totalMembers}
          onPageChange={onPageChange}
        />
      )}
    </section>
  )
}

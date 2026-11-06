import { HomePageCommunitiesPreview } from './HomePageCommunitiesPreview.component'
import { HomePageFriendsPreview } from './HomePageFriendsPreview.component'
import { HomePageSuggestedCommunitiesPreview } from './HomePageSuggestedCommunitiesPreview.component'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

export function HomePageRightSidebar({
  currentProfile,
  friendsQuery,
  communitiesQuery,
  allCommunitiesQuery,
  ownedCommunityIdsQuery,
  friends,
  communities,
  suggestions
}: HomePageRightSidebarProps) {
  return (
    <div className="home-page__previews">
      <HomePageFriendsPreview
        profileUrl={currentProfile.url}
        friendsQuery={friendsQuery}
        friends={friends}
      />
      <HomePageCommunitiesPreview
        profileUrl={currentProfile.url}
        communitiesQuery={communitiesQuery}
        communities={communities}
      />
      <HomePageSuggestedCommunitiesPreview
        allCommunitiesQuery={allCommunitiesQuery}
        ownedCommunityIdsQuery={ownedCommunityIdsQuery}
        suggestions={suggestions}
      />
    </div>
  )
}

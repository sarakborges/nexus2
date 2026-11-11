import { HomePageCommunitiesPreview } from './HomePageCommunitiesPreview.component'
import { HomePageFriendsPreview } from './HomePageFriendsPreview.component'
import { HomePageSuggestedCommunitiesPreview } from './HomePageSuggestedCommunitiesPreview.component'
import type { HomePageRightSidebarProps } from './HomePageRightSidebar.types'

export function HomePageRightSidebar({
  currentProfile,
  homeQuery
}: HomePageRightSidebarProps) {
  return (
    <div className="home-page__previews">
      <HomePageFriendsPreview
        profileUrl={currentProfile.url}
        homeQuery={homeQuery}
      />
      <HomePageCommunitiesPreview
        profileUrl={currentProfile.url}
        homeQuery={homeQuery}
      />
      <HomePageSuggestedCommunitiesPreview homeQuery={homeQuery} />
    </div>
  )
}

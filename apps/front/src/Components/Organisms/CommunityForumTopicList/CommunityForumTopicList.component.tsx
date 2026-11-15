import type { CommunityForumTopicListProps } from './CommunityForumTopicList.types'
import { CommunityForumTopicItem } from '@/Components/Molecules/CommunityForumTopicItem'

import './CommunityForumTopicList.style.scss'

export function CommunityForumTopicList({
  communityUrl,
  topics,
  authorsById
}: CommunityForumTopicListProps) {
  return (
    <div className="community-forum-topic-list">
      {topics.map((topic) => (
        <CommunityForumTopicItem
          key={topic.id}
          topic={topic}
          communityUrl={communityUrl}
          author={authorsById.get(topic.profileId)}
        />
      ))}
    </div>
  )
}

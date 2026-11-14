import { ProfileMessageItem } from './ProfileMessageItem.component'
import type { ProfileMessageListProps } from './ProfileMessageList.types'

import './ProfileMessageList.style.scss'

export function ProfileMessageList({
  items,
  isActionPending,
  onDelete,
  onFavorite,
  onReply
}: ProfileMessageListProps) {
  return (
    <div className="profile-message-list">
      {items.map(item => (
        <ProfileMessageItem
          key={item.message.id}
          item={item}
          isActionPending={isActionPending}
          onDelete={onDelete}
          onFavorite={onFavorite}
          onReply={onReply}
        />
      ))}
    </div>
  )
}

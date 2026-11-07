import type { Community } from '@nexus/common'

export type CommunityPageAboutPreviewProps = {
  community: Pick<Community, 'url' | 'about'>
  canViewMembers: boolean
  canEditCommunity: boolean
  pendingRequestCount: number
  onEdit: () => void
}

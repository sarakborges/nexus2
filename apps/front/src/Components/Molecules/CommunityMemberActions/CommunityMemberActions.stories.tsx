import { CommunityMemberActions } from './CommunityMemberActions.component'
import type { CommunityRelationship } from '@nexus/common'
import type { Meta, StoryObj } from '@storybook/react-vite'

type RelationshipPreviewProps = {
  type: 'connection' | 'moderator' | 'requested' | 'blocked'
}

function RelationshipPreview({ type }: RelationshipPreviewProps) {
  const relationship: CommunityRelationship = {
    profiles: ['profile-member', 'community-example'],
    type,
    requestedBy: type === 'requested' ? 'profile-member' : null,
    blockedBy: type === 'blocked' ? 'profile-owner' : null,
    updatedAt: 1
  }

  return (
    <CommunityMemberActions
      memberProfileId="profile-member"
      communityId="community-example"
      actorProfileId="profile-owner"
      actorRole="owner"
      relationship={relationship}
    />
  )
}

const meta = {
  title: 'Application/Molecules/CommunityMemberActions',
  component: CommunityMemberActions,
  args: {
    memberProfileId: 'profile-member',
    communityId: 'community-example',
    actorProfileId: 'profile-owner',
    actorRole: 'owner' as const,
    relationship: {
      profiles: ['profile-member', 'community-example'],
      type: 'connection' as const,
      requestedBy: null,
      blockedBy: null,
      updatedAt: 1
    }
  }
} satisfies Meta<typeof CommunityMemberActions>

export default meta

type Story = StoryObj<typeof meta>

export const Member: Story = {
  render: () => <RelationshipPreview type="connection" />
}

export const Moderator: Story = {
  render: () => <RelationshipPreview type="moderator" />
}

export const PendingRequest: Story = {
  render: () => <RelationshipPreview type="requested" />
}

export const BannedMember: Story = {
  render: () => <RelationshipPreview type="blocked" />
}

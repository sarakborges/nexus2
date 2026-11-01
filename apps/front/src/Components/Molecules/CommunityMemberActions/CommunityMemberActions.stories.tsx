import { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

import { CommunityMemberActions } from './CommunityMemberActions.component'

type RelationshipPreviewProps = {
  type: 'connection' | 'moderator' | 'requested' | 'blocked'
}

function RelationshipPreview({ type }: RelationshipPreviewProps) {
  useEffect(() => {
    const previousRelationships =
      useCommunityRelationshipStore.getState().relationships

    useCommunityRelationshipStore.setState({
      relationships: [
        {
          profiles: ['profile-member', 'community-example'],
          type,
          requestedBy: type === 'requested' ? 'profile-member' : null,
          blockedBy: type === 'blocked' ? 'profile-owner' : null,
          updatedAt: 1
        },
        {
          profiles: ['profile-owner', 'community-example'],
          type: 'owner',
          requestedBy: null,
          blockedBy: null,
          updatedAt: 1
        }
      ]
    })

    return () => {
      useCommunityRelationshipStore.setState({
        relationships: previousRelationships
      })
    }
  }, [type])

  return (
    <CommunityMemberActions
      memberProfileId="profile-member"
      communityId="community-example"
      actorProfileId="profile-owner"
      actorRole="owner"
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
    actorRole: 'owner'
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

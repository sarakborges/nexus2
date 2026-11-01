import { useEffect } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { useCommunityRelationshipStore } from '@/Stores/CommunityRelationship.store'

import { CommunityMemberActions } from './CommunityMemberActions.component'

type RelationshipPreviewProps = {
  type: 'connection' | 'requested' | 'blocked'
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
      ownerProfileId="profile-owner"
    />
  )
}

const meta = {
  title: 'Application/Molecules/CommunityMemberActions',
  component: CommunityMemberActions,
  args: {
    memberProfileId: 'profile-member',
    communityId: 'community-example',
    ownerProfileId: 'profile-owner'
  }
} satisfies Meta<typeof CommunityMemberActions>

export default meta

type Story = StoryObj<typeof meta>

export const PendingRequest: Story = {
  render: () => <RelationshipPreview type="requested" />
}

export const ConnectedMember: Story = {
  render: () => <RelationshipPreview type="connection" />
}

export const BlockedMember: Story = {
  render: () => <RelationshipPreview type="blocked" />
}

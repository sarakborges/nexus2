import type { Meta, StoryObj } from '@storybook/react-vite'

import { RelationshipActions } from './RelationshipActions.component'

const meta = {
  title: 'Application/Molecules/RelationshipActions',
  component: RelationshipActions,
  args: {
    targetId: 'profile-target'
  }
} satisfies Meta<typeof RelationshipActions>

export default meta

type Story = StoryObj<typeof meta>

export const SignedOut: Story = {}

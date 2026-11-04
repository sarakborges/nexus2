import { RelationshipActions } from './RelationshipActions.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

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

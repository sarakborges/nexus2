import type { Meta, StoryObj } from '@storybook/react-vite'

import { Label } from './Label.component'

const meta = {
  title: 'Design System/Atoms/Label',
  component: Label,
  args: {
    htmlFor: 'email',
    children: 'Email address'
  }
} satisfies Meta<typeof Label>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

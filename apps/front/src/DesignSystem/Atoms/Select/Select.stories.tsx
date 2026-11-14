import type { Meta, StoryObj } from '@storybook/react-vite'

import { Select } from './Select.component'

const meta = {
  title: 'Design System/Atoms/Select',
  component: Select,
  args: {
    defaultValue: 'all',
    children: (
      <>
        <option value="all">All</option>
        <option value="profiles">Profiles</option>
        <option value="communities">Communities</option>
      </>
    )
  }
} satisfies Meta<typeof Select>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true }
}

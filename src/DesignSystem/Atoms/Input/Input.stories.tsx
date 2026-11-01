import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from './Input.component'

const meta = {
  title: 'Design System/Atoms/Input',
  component: Input,
  args: {
    type: 'text',
    placeholder: 'Type something'
  }
} satisfies Meta<typeof Input>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Disabled input' }
}

export const WithValue: Story = {
  args: { defaultValue: 'Nexus' }
}

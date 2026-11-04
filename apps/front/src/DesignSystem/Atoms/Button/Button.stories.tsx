import { Button } from './Button.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Atoms/Button',
  component: Button,
  args: {
    children: 'Button'
  },
  argTypes: {
    variation: {
      control: 'select',
      options: ['primary', 'secondary', 'cancel', 'transparent']
    }
  }
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: { variation: 'primary' }
}

export const Secondary: Story = {
  args: { variation: 'secondary' }
}

export const Cancel: Story = {
  args: { variation: 'cancel' }
}

export const Transparent: Story = {
  args: { variation: 'transparent' }
}

export const Disabled: Story = {
  args: { disabled: true }
}

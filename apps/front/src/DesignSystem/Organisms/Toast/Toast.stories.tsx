import type { Meta, StoryObj } from '@storybook/react-vite'

import { Toast } from './Toast.component'

const meta = {
  title: 'Design System/Organisms/Toast',
  component: Toast,
  args: {
    children: 'Your changes have been saved.',
    duration: 5000,
    tone: 'success'
  },
  argTypes: {
    tone: {
      control: 'select',
      options: ['info', 'success', 'warning', 'error']
    },
    duration: {
      control: 'number',
      description: 'Auto-dismiss delay in milliseconds. Use 0 to keep visible.'
    }
  }
} satisfies Meta<typeof Toast>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: {
    tone: 'info',
    children: 'A new update is available.'
  }
}

export const Success: Story = {
  args: {
    tone: 'success',
    children: 'Your changes have been saved.'
  }
}

export const Warning: Story = {
  args: {
    tone: 'warning',
    children: 'Your session is about to expire.'
  }
}

export const Error: Story = {
  args: {
    tone: 'error',
    role: 'alert',
    children: 'The operation could not be completed.'
  }
}

export const Persistent: Story = {
  args: {
    duration: 0,
    children: 'This notification does not auto-dismiss.'
  }
}

import type { Meta, StoryObj } from '@storybook/react-vite'

import { Text } from './Text.component'

const meta = {
  title: 'Design System/Atoms/Text',
  component: Text,
  args: {
    children: 'Nexus component library'
  },
  argTypes: {
    as: {
      control: 'select',
      options: ['span', 'p', 'h1', 'h2']
    }
  }
} satisfies Meta<typeof Text>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Paragraph: Story = {
  args: {
    as: 'p',
    children:
      'Text is a presentational primitive. Paragraph structure and content remain the responsibility of the page or feature.'
  }
}

export const Heading: Story = {
  args: {
    as: 'h1',
    children: 'A page heading'
  }
}

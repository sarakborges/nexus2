import type { Meta, StoryObj } from '@storybook/react-vite'

import { Portrait } from './Portrait.component'

const meta = {
  title: 'Design System/Atoms/Portrait',
  component: Portrait,
  args: {
    src: '/languages/pt-BR.svg',
    alt: 'Brazilian flag',
    width: 64,
    height: 64
  }
} satisfies Meta<typeof Portrait>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const UnitedStates: Story = {
  args: {
    src: '/languages/en-US.svg',
    alt: 'United States flag'
  }
}

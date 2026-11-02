import type { Meta, StoryObj } from '@storybook/react-vite'
import { ThemeSelector } from './ThemeSelector.component'

const meta = {
  title: 'Application/Organisms/ThemeSelector',
  component: ThemeSelector
} satisfies Meta<typeof ThemeSelector>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

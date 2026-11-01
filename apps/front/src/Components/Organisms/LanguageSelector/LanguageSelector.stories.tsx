import type { Meta, StoryObj } from '@storybook/react-vite'

import { LanguageSelector } from './LanguageSelector.component'

const meta = {
  title: 'Application/Organisms/LanguageSelector',
  component: LanguageSelector
} satisfies Meta<typeof LanguageSelector>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

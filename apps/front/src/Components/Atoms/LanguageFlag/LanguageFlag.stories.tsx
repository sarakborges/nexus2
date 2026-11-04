import { LanguageFlag } from './LanguageFlag.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Application/Atoms/LanguageFlag',
  component: LanguageFlag,
  args: {
    language: 'pt-BR'
  }
} satisfies Meta<typeof LanguageFlag>

export default meta

type Story = StoryObj<typeof meta>

export const BrazilianPortuguese: Story = {}

export const UnitedStatesEnglish: Story = {
  args: { language: 'en-US' }
}

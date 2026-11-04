import { LanguageOption } from './LanguageOption.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Application/Molecules/LanguageOption',
  component: LanguageOption,
  args: {
    language: 'pt-BR'
  }
} satisfies Meta<typeof LanguageOption>

export default meta

type Story = StoryObj<typeof meta>

export const SystemPreference: Story = {
  args: { language: 'system' }
}

export const BrazilianPortuguese: Story = {}

export const UnitedStatesEnglish: Story = {
  args: { language: 'en-US' }
}

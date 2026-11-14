import type { Meta, StoryObj } from '@storybook/react-vite'

import { SelectField } from './SelectField.component'

const meta = {
  title: 'Design System/Molecules/SelectField',
  component: SelectField,
  args: {
    id: 'visibility',
    label: 'Visibility',
    defaultValue: 'public',
    children: (
      <>
        <option value="public">Public</option>
        <option value="private">Private</option>
        <option value="unlisted">Unlisted</option>
      </>
    )
  }
} satisfies Meta<typeof SelectField>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Disabled: Story = {
  args: { disabled: true }
}

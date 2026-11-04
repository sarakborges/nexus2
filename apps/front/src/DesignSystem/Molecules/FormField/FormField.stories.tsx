import { FormField } from './FormField.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Design System/Molecules/FormField',
  component: FormField,
  args: {
    id: 'email',
    label: 'Email address',
    type: 'email',
    placeholder: 'name@example.com'
  }
} satisfies Meta<typeof FormField>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Required: Story = {
  args: { required: true }
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'name@example.com' }
}

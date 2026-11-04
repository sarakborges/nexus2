import { Modal } from './Modal.component'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { useState } from 'react'
import type { ComponentProps } from 'react'

import { Button } from '@/DesignSystem/Atoms/Button'

const meta = {
  title: 'Design System/Organisms/Modal',
  component: Modal,
  args: {
    open: true,
    title: 'Example dialog',
    children: 'This is a native modal dialog with focus and keyboard handling.',
    onClose: () => undefined
  }
} satisfies Meta<typeof Modal>

export default meta

type Story = StoryObj<typeof meta>

function ModalPreview(args: ComponentProps<typeof Modal>) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <>
      <Button variation="secondary" onClick={() => setIsOpen(true)}>
        Open modal
      </Button>

      <Modal {...args} open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  )
}

export const Default: Story = {
  render: (args) => <ModalPreview {...args} />
}

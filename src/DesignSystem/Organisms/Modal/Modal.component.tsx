import type { HTMLAttributes } from 'react'

import './Modal.style.scss'

type ModalProps = HTMLAttributes<HTMLDivElement>

export function Modal({
  children,
  className,
  role = 'dialog',
  'aria-modal': ariaModal = true,
  ...props
}: ModalProps) {
  const classNames = ['modal', className].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      role={role}
      aria-modal={ariaModal}
      {...props}
    >
      {children}
    </div>
  )
}

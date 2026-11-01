import type { ButtonHTMLAttributes } from 'react'

import { Button } from '@/DesignSystem/Atoms/Button'

import './ShadowButton.style.scss'

type ShadowButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

export function ShadowButton({
  children,
  className,
  ...props
}: ShadowButtonProps) {
  const classNames = ['shadow-button', className].filter(Boolean).join(' ')

  return (
    <Button className={classNames} variant="ghost" {...props}>
      <div className="button-content">{children}</div>

      <div className="button-bg" aria-hidden="true">
        <div />
        <div />
      </div>
    </Button>
  )
}

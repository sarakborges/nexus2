import type { SocialPanelProps } from './SocialPanel.types'

import './SocialPanel.style.scss'

export function SocialPanel({ children, className, ...props }: SocialPanelProps) {
  return (
    <article className={['social-panel', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </article>
  )
}

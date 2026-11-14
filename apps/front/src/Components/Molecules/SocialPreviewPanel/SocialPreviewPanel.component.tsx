import type { SocialPreviewPanelProps } from './SocialPreviewPanel.types'

import './SocialPreviewPanel.style.scss'

export function SocialPreviewPanel({
  title,
  count,
  headerActions,
  children,
  className
}: SocialPreviewPanelProps) {
  return (
    <section className={['social-preview-panel', className].filter(Boolean).join(' ')}>
      <header className="social-preview-panel__header">
        <h2>
          {title}
          {count !== undefined && count !== null && (
            <span className="social-preview-panel__count">({count})</span>
          )}
        </h2>
        {headerActions}
      </header>
      {children}
    </section>
  )
}

import { AuthenticatedPageTemplate } from '@/Components/Organisms/AuthenticatedPageTemplate'
import type { SocialPageLayoutProps } from './SocialPageLayout.types'

import '@/Components/Molecules/AccountCard/AccountCard.style.scss'

export function SocialPageLayout({
  sidebar,
  children,
  rightSidebar,
  className = ''
}: SocialPageLayoutProps) {
  const layoutClass = sidebar && rightSidebar
    ? ''
    : sidebar
      ? 'social-page__layout--two-column'
      : rightSidebar
        ? 'social-page__layout--right-sidebar-only'
        : 'social-page__layout--no-sidebar'

  return (
    <AuthenticatedPageTemplate className={['social-page', className].filter(Boolean).join(' ')}>
      <div
        className={['social-page__layout', layoutClass]
          .filter(Boolean)
          .join(' ')}
      >
        {sidebar && <aside className="social-page__left-column">{sidebar}</aside>}
        <section className="social-page__main-column">{children}</section>
        {rightSidebar && (
          <aside className="social-page__right-column">{rightSidebar}</aside>
        )}
      </div>
    </AuthenticatedPageTemplate>
  )
}

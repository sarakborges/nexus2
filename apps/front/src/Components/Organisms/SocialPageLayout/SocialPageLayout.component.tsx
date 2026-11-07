import type { SocialPageLayoutProps } from './SocialPageLayout.types'

export function SocialPageLayout({
  sidebar,
  children,
  rightSidebar,
  className = ''
}: SocialPageLayoutProps) {
  const columnsClass = rightSidebar ? '' : 'social-page__layout--two-column'

  return (
    <main className={['social-page', className].filter(Boolean).join(' ')}>
      <div
        className={['social-page__layout', columnsClass]
          .filter(Boolean)
          .join(' ')}
      >
        <aside className="social-page__left-column">{sidebar}</aside>
        <section className="social-page__main-column">{children}</section>
        {rightSidebar && (
          <aside className="social-page__right-column">{rightSidebar}</aside>
        )}
      </div>
    </main>
  )
}

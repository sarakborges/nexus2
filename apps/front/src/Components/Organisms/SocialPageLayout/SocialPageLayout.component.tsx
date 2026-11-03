import type { ReactNode } from 'react'
import '@/pages/ProfilePage/ProfilePage.style.scss'

type SocialPageLayoutProps = {
  sidebar: ReactNode
  children: ReactNode
  aside?: ReactNode
  className?: string
}

export function SocialPageLayout({ sidebar, children, aside, className = '' }: SocialPageLayoutProps) {
  const layoutClassName = [
    'social-page__layout',
    aside ? '' : 'social-page__layout--two-column'
  ].filter(Boolean).join(' ')

  return (
    <main className={['social-page', className].filter(Boolean).join(' ')}>
      <div className={layoutClassName}>
        <aside className="social-page__left-column">{sidebar}</aside>
        <section className="social-page__main-column">{children}</section>
        {aside && <aside className="social-page__right-column">{aside}</aside>}
      </div>
    </main>
  )
}

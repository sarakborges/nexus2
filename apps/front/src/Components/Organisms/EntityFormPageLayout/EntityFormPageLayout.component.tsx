import type { EntityFormPageLayoutProps } from './EntityFormPageLayout.types'

export function EntityFormPageLayout({
  title,
  description,
  titleId,
  children
}: EntityFormPageLayoutProps) {
  return (
    <main className="auth-page">
      <section
        className="entity-form-page"
        aria-labelledby={titleId}
      >
        <header className="entity-form-page__header">
          <h1 className="auth-card__title" id={titleId}>
            {title}
          </h1>
          <p className="auth-card__description">{description}</p>
        </header>
        {children}
      </section>
    </main>
  )
}

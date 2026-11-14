import { AuthenticatedPageTemplate } from '@/Components/Organisms/AuthenticatedPageTemplate'

import type { EntityFormPageLayoutProps } from './EntityFormPageLayout.types'

import './EntityFormPageLayout.style.scss'

export function EntityFormPageLayout({
  title,
  description,
  titleId,
  children
}: EntityFormPageLayoutProps) {
  return (
    <AuthenticatedPageTemplate className="entity-form-page-template">
      <section
        className="entity-form-page"
        aria-labelledby={titleId}
      >
        {(title || description) && (
          <header className="entity-form-page__header">
            {title && (
              <h1 className="entity-form-page__title" id={titleId}>
                {title}
              </h1>
            )}
            {description && (
              <p className="entity-form-page__description">{description}</p>
            )}
          </header>
        )}
        {children}
      </section>
    </AuthenticatedPageTemplate>
  )
}

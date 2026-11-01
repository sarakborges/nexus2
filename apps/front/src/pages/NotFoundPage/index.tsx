import { Link } from 'react-router'

import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'

import './NotFoundPage.style.scss'

export function NotFoundPage() {
  const { t } = useTranslations()

  return (
    <main className="not-found-page">
      <section className="not-found-page__content" aria-labelledby="not-found-title">
        <p className="not-found-page__code" aria-hidden="true">
          {t('NOT_FOUND_CODE')}
        </p>
        <h1 className="not-found-page__title" id="not-found-title">
          {t('NOT_FOUND_TITLE')}
        </h1>
        <p className="not-found-page__description">
          {t('NOT_FOUND_DESCRIPTION')}
        </p>
        <Link className="not-found-page__link" to={ROUTES.landing}>
          {t('NOT_FOUND_HOME_LINK')}
        </Link>
      </section>
    </main>
  )
}

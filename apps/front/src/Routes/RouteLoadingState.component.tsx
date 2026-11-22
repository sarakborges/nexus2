import { RequestState } from '@/Components'

export function RouteLoadingState() {
  return (
    <main className="account-page">
      <section className="account-card">
        <RequestState isLoading />
      </section>
    </main>
  )
}

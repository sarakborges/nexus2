import { AccountCard, RequestState } from '@/Components/Molecules'
import { AuthenticatedPageTemplate } from '@/Components/Organisms/AuthenticatedPageTemplate'

import type { AuthenticatedPageStateProps } from './AuthenticatedPageState.types'

export function AuthenticatedPageState({
  isLoading = false,
  isFetching = false,
  isError = false,
  onRetry
}: AuthenticatedPageStateProps) {
  return (
    <AuthenticatedPageTemplate>
      <AccountCard>
        <RequestState
          isLoading={isLoading}
          isFetching={isFetching}
          isError={isError}
          onRetry={onRetry}
        />
      </AccountCard>
    </AuthenticatedPageTemplate>
  )
}

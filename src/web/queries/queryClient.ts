/**
 * Factory rather than a module-level singleton, exported so tests build
 * their own client (matching the repo's factory convention — createApp(db),
 * createDbClient(url), createApiClient(options)) and so each test gets an
 * isolated cache with no state leaking between them.
 */

import { QueryClient } from '@tanstack/react-query'

import { isApiError } from '../net/apiError.js'

const MAX_RETRIES = 2

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is cheap to refetch here and a stale balance is worse than a
        // refetch, so nothing is ever considered fresh.
        staleTime: 0,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // A 4xx means the request itself is wrong (a group that doesn't
          // exist, a duplicate name) — retrying can't fix that, and without
          // this a GROUP_NOT_FOUND would spin through several round trips
          // before the user ever sees it. Only 5xx and NETWORK_ERROR (whose
          // synthetic status is 0) are worth a couple of retries.
          if (isApiError(error) && error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < MAX_RETRIES
        },
      },
      mutations: {
        // POST/DELETE are not safely retryable here — a retried POST could
        // double-create, and a retried DELETE racing a 404 is just noise.
        retry: false,
      },
    },
  })
}

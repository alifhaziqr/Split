/**
 * Gives components the injected ApiClient rather than a global default — the
 * same seam createApiClient's own `fetch` option gives tests, one level up.
 * A component test can then render with a fake client instead of a fake
 * fetch (see tests/web/queries/*.test.tsx for the pattern), and the real
 * app wires the one real client created in main.tsx.
 */

import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'

import type { ApiClient } from './client.js'

const ApiClientContext = createContext<ApiClient | null>(null)

export function ApiClientProvider(props: {
  readonly client: ApiClient
  readonly children: ReactNode
}) {
  return (
    <ApiClientContext.Provider value={props.client}>
      {props.children}
    </ApiClientContext.Provider>
  )
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (client === null) {
    throw new Error('useApiClient must be used within an ApiClientProvider')
  }
  return client
}

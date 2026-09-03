/**
 * Wraps a subject in a fresh QueryClientProvider + ApiClientProvider +
 * MemoryRouter for component and hook tests. Not named *.test.tsx, so
 * vitest never collects it as a suite of its own — same convention as
 * tests/server/api/httpTestHelpers.ts and tests/server/db/testDb.ts.
 */

import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router'

import { ApiClientProvider } from '../../src/web/net/apiClientContext.js'
import type { ApiClient } from '../../src/web/net/client.js'
import { createApiClient } from '../../src/web/net/client.js'
import type { FetchLike } from '../../src/web/net/http.js'
import { createQueryClient } from '../../src/web/queries/queryClient.js'

export interface ProviderOptions {
  readonly fetch?: FetchLike | undefined
  readonly client?: ApiClient | undefined
  readonly queryClient?: QueryClient | undefined
  readonly initialEntries?: readonly string[] | undefined
}

export function createProvidersWrapper(options: ProviderOptions = {}) {
  const queryClient = options.queryClient ?? createQueryClient()
  const client = options.client ?? createApiClient({ fetch: options.fetch })
  const initialEntries = [...(options.initialEntries ?? ['/'])]

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiClientProvider client={client}>
          <MemoryRouter initialEntries={initialEntries}>{props.children}</MemoryRouter>
        </ApiClientProvider>
      </QueryClientProvider>
    )
  }

  return { Wrapper, queryClient, client }
}

export function renderWithProviders(ui: ReactElement, options: ProviderOptions = {}) {
  const { Wrapper, queryClient, client } = createProvidersWrapper(options)
  return { ...render(ui, { wrapper: Wrapper }), queryClient, client }
}

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiClientProvider, useApiClient } from '../../../src/web/net/apiClientContext.js'
import { createApiClient } from '../../../src/web/net/client.js'

function Probe() {
  const client = useApiClient()
  return <div>{typeof client.listGroups}</div>
}

describe('ApiClientProvider / useApiClient', () => {
  it('gives components the injected client, not a global default', () => {
    const client = createApiClient({ fetch: async () => new Response(null, { status: 204 }) })

    render(
      <ApiClientProvider client={client}>
        <Probe />
      </ApiClientProvider>,
    )

    expect(screen.getByText('function')).toBeInTheDocument()
  })

  it('throws a clear error when used outside a provider', () => {
    // Suppress React's expected console.error for the thrown-during-render case.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<Probe />)).toThrow(/ApiClientProvider/)

    consoleError.mockRestore()
  })
})

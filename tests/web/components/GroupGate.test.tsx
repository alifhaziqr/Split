import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Route, Routes } from 'react-router'

import { GroupGate } from '../../../src/web/components/GroupGate.js'
import { createFetchStub } from '../fetchStub.js'
import { createProvidersWrapper } from '../renderWithProviders.js'

const GROUP_DETAILS = {
  id: 'g1',
  name: 'Trip',
  currency: 'USD',
  createdAt: '2026-09-01T00:00:00.000Z',
  members: [{ id: 'm1', name: 'Ana' }],
  expenses: [],
}

// No default for groupId: a caller passing `undefined` explicitly (to
// exercise the throw-on-missing-param branch) must not be silently
// upgraded to 'g1' by JS's own default-parameter substitution.
function renderGate(fetch: ReturnType<typeof createFetchStub>['fetch'], groupId: string | undefined) {
  const { Wrapper } = createProvidersWrapper({ fetch, initialEntries: ['/groups/g1'] })
  return render(
    <Routes>
      <Route
        path="/groups/:groupId"
        element={<GroupGate groupId={groupId}>{(details) => <p>ready: {details.name}</p>}</GroupGate>}
      />
      <Route path="/" element={<p>Home page</p>} />
    </Routes>,
    { wrapper: Wrapper },
  )
}

describe('GroupGate', () => {
  it('renders a loading indicator while the group query is pending', () => {
    const stub = createFetchStub()
    renderGate(stub.fetch, 'g1')

    expect(screen.getByRole('status')).toHaveTextContent(/loading group/i)
  })

  it('renders the missing-group notice, with a working link home, for GROUP_NOT_FOUND', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', {
      status: 404,
      body: { error: { code: 'GROUP_NOT_FOUND', message: 'ignored' } },
    })
    const user = userEvent.setup()
    renderGate(stub.fetch, 'g1')

    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: /groups/i }))
    expect(await screen.findByText('Home page')).toBeInTheDocument()
  })

  it('renders a generic error banner for any other failure', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'ignored' } },
    })
    renderGate(stub.fetch, 'g1')

    // Default timeout: the query client retries a 5xx twice with backoff
    // (see queryClient.ts) before settling as an error — this waits out
    // that real production delay rather than fighting it.
    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(/something went wrong/i)
  })

  it('renders the children with the fetched group details once ready', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', { status: 200, body: GROUP_DETAILS })
    renderGate(stub.fetch, 'g1')

    await waitFor(() => expect(screen.getByText('ready: Trip')).toBeInTheDocument())
  })

  it('throws when rendered without a groupId — a route-table precondition, not a user-facing state', () => {
    const stub = createFetchStub()

    expect(() => renderGate(stub.fetch, undefined)).toThrow()
  })
})

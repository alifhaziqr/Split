import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from '../../src/web/App.js'
import { createFetchStub } from './fetchStub.js'
import { createProvidersWrapper } from './renderWithProviders.js'

function renderApp(
  fetch: ReturnType<typeof createFetchStub>['fetch'],
  initialEntries: string[],
) {
  const { Wrapper } = createProvidersWrapper({ fetch, initialEntries })
  return render(<App />, { wrapper: Wrapper })
}

describe('App', () => {
  it('renders GroupsPage at /', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups', { status: 200, body: { groups: [] } })
    renderApp(stub.fetch, ['/'])

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Groups' })).toBeInTheDocument(),
    )
  })

  it('renders GroupDetailPage at /groups/:groupId', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', {
      status: 200,
      body: {
        id: 'g1',
        name: 'Trip',
        currency: 'USD',
        createdAt: '2026-09-01T00:00:00.000Z',
        members: [],
        expenses: [],
      },
    })
    stub.queueResponse('GET', '/api/groups/g1/settlement', {
      status: 200,
      body: { balances: [], transfers: [] },
    })
    renderApp(stub.fetch, ['/groups/g1'])

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Trip' })).toBeInTheDocument(),
    )
  })

  it('renders NotFoundPage for an unknown path', () => {
    const stub = createFetchStub()
    renderApp(stub.fetch, ['/this/path/does/not/exist'])

    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})

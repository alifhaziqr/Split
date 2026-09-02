import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GroupsPage } from '../../../src/web/pages/GroupsPage.js'
import { createFetchStub } from '../fetchStub.js'
import { renderWithProviders } from '../renderWithProviders.js'

describe('GroupsPage', () => {
  it('renders the create-group form and the fetched group list', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups', {
      status: 200,
      body: { groups: [{ id: 'g1', name: 'Trip', currency: 'USD', createdAt: '2026-09-01T00:00:00.000Z' }] },
    })
    renderWithProviders(<GroupsPage />, { fetch: stub.fetch })

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('link', { name: /Trip/ })).toBeInTheDocument())
  })

  it('renders an empty state when there are no groups', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups', { status: 200, body: { groups: [] } })
    renderWithProviders(<GroupsPage />, { fetch: stub.fetch })

    await waitFor(() => expect(screen.getByText(/no groups yet/i)).toBeInTheDocument())
  })
})

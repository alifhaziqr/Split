import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AddExpensePage } from '../../../src/web/pages/AddExpensePage.js'
import { createFetchStub } from '../fetchStub.js'
import { renderWithProviders } from '../renderWithProviders.js'

const GROUP_DETAILS = {
  id: 'g1',
  name: 'Trip',
  currency: 'USD',
  createdAt: '2026-09-01T00:00:00.000Z',
  members: [
    { id: 'm1', name: 'Ana' },
    { id: 'm2', name: 'Bob' },
  ],
  expenses: [],
}

function renderPage(fetch: ReturnType<typeof createFetchStub>['fetch']) {
  return renderWithProviders(
    <Routes>
      <Route path="/groups/:groupId/expenses/new" element={<AddExpensePage />} />
      <Route path="/groups/:groupId" element={<div>Group detail page</div>} />
      <Route path="/" element={<div>Home page</div>} />
    </Routes>,
    { fetch, initialEntries: ['/groups/g1/expenses/new'] },
  )
}

describe('AddExpensePage', () => {
  it('loads members from the group query and hosts the add-expense form', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', { status: 200, body: GROUP_DETAILS })
    renderPage(stub.fetch)

    await waitFor(() => expect(screen.getByLabelText(/paid by/i)).toBeInTheDocument())
    expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument()
  })

  it('navigates back to the group detail route on a successful submit', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', { status: 200, body: GROUP_DETAILS })
    stub.queueResponse('POST', '/api/groups/g1/expenses', {
      status: 201,
      body: { id: 'e1' },
    })
    const user = userEvent.setup()
    renderPage(stub.fetch)

    await waitFor(() => expect(screen.getByLabelText(/paid by/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/description/i), 'Dinner')
    await user.type(screen.getByLabelText(/^amount/i), '10.00')
    await user.selectOptions(screen.getByLabelText(/paid by/i), 'm1')
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-09-02' } })
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await waitFor(() => expect(screen.getByText('Group detail page')).toBeInTheDocument())
  })

  it('renders a dedicated missing-group state for GROUP_NOT_FOUND, matching GroupDetailPage — not a generic error banner', async () => {
    const stub = createFetchStub()
    stub.queueResponse('GET', '/api/groups/g1', {
      status: 404,
      body: { error: { code: 'GROUP_NOT_FOUND', message: 'ignored' } },
    })
    renderPage(stub.fetch)

    expect(await screen.findByText(/no longer exists/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /groups/i })).toHaveAttribute('href', '/')
  })
})

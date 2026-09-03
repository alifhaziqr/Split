import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { GroupHeader } from '../../../../src/web/features/groups/GroupHeader.js'
import type { WireGroupDetails } from '../../../../src/web/net/types.js'
import { createFetchStub } from '../../fetchStub.js'
import { renderWithProviders } from '../../renderWithProviders.js'

const EMPTY_GROUP: WireGroupDetails = {
  id: 'g1',
  name: 'Trip',
  currency: 'USD',
  createdAt: '2026-09-01T00:00:00.000Z',
  members: [],
  expenses: [],
}

const NON_EMPTY_GROUP: WireGroupDetails = {
  ...EMPTY_GROUP,
  members: [{ id: 'm1', name: 'Ana' }],
  expenses: [],
}

function renderHeader(
  group: WireGroupDetails,
  fetch: ReturnType<typeof createFetchStub>['fetch'],
) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<div>Home page</div>} />
      <Route path="/groups/:groupId" element={<GroupHeader group={group} />} />
    </Routes>,
    { fetch, initialEntries: ['/groups/g1'] },
  )
}

describe('GroupHeader', () => {
  it('renders the group name and currency', () => {
    const stub = createFetchStub()
    renderHeader(EMPTY_GROUP, stub.fetch)

    expect(screen.getByText('Trip')).toBeInTheDocument()
    expect(screen.getByText('USD')).toBeInTheDocument()
  })

  it('predicts GROUP_NOT_EMPTY: disables delete with a visible reason when the group has members', () => {
    const stub = createFetchStub()
    renderHeader(NON_EMPTY_GROUP, stub.fetch)

    const deleteButton = screen.getByRole('button', { name: /delete group/i })
    expect(deleteButton).toBeDisabled()
    expect(screen.getByText(/still has/i)).toBeInTheDocument()
  })

  it('deletes an empty group after confirmation and navigates home', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1', { status: 204 })
    const user = userEvent.setup()
    renderHeader(EMPTY_GROUP, stub.fetch)

    const deleteButton = screen.getByRole('button', { name: /delete group/i })
    expect(deleteButton).not.toBeDisabled()
    await user.click(deleteButton)
    await user.click(screen.getByRole('button', { name: /sure/i }))

    await waitFor(() => expect(screen.getByText('Home page')).toBeInTheDocument())
  })

  it('renders a GROUP_NOT_EMPTY 409 from a stale-cache race next to the button', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1', {
      status: 409,
      body: { error: { code: 'GROUP_NOT_EMPTY', message: 'still has stuff' } },
    })
    const user = userEvent.setup()
    // Cache says empty (stale), server disagrees.
    renderHeader(EMPTY_GROUP, stub.fetch)

    await user.click(screen.getByRole('button', { name: /delete group/i }))
    await user.click(screen.getByRole('button', { name: /sure/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/members or expenses/i)
  })
})

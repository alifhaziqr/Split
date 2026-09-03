import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useParams } from 'react-router'
import { describe, expect, it } from 'vitest'

import { CreateGroupForm } from '../../../../src/web/features/groups/CreateGroupForm.js'
import { createFetchStub } from '../../fetchStub.js'
import { renderWithProviders } from '../../renderWithProviders.js'

function GroupPageProbe() {
  const { groupId } = useParams()
  return <div>Group page: {groupId}</div>
}

describe('CreateGroupForm', () => {
  it('submits name and currency, then navigates to the new group', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups', {
      status: 201,
      body: { id: 'g1', name: 'Trip', currency: 'USD' },
    })
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/" element={<CreateGroupForm />} />
        <Route path="/groups/:groupId" element={<GroupPageProbe />} />
      </Routes>,
      { fetch: stub.fetch },
    )

    await user.type(screen.getByLabelText(/name/i), 'Trip')
    await user.type(screen.getByLabelText(/currency/i), 'USD')
    await user.click(screen.getByRole('button', { name: /create group/i }))

    await waitFor(() => expect(screen.getByText('Group page: g1')).toBeInTheDocument())
    expect(stub.calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/groups',
      body: { name: 'Trip', currency: 'USD' },
    })
  })

  it('shows the server error and does not navigate on failure', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups', {
      status: 422,
      body: { error: { code: 'VALIDATION_FAILED', message: 'bad' } },
    })
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/" element={<CreateGroupForm />} />
        <Route path="/groups/:groupId" element={<GroupPageProbe />} />
      </Routes>,
      { fetch: stub.fetch },
    )

    await user.type(screen.getByLabelText(/name/i), 'Trip')
    await user.type(screen.getByLabelText(/currency/i), 'USD')
    await user.click(screen.getByRole('button', { name: /create group/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText(/Group page:/)).not.toBeInTheDocument()
  })
})

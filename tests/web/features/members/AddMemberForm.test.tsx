import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AddMemberForm } from '../../../../src/web/features/members/AddMemberForm.js'
import { createFetchStub } from '../../fetchStub.js'
import { renderWithProviders } from '../../renderWithProviders.js'

describe('AddMemberForm', () => {
  it('adds a member and clears the input on success', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/members', {
      status: 201,
      body: { id: 'm1', name: 'Ana' },
    })
    const user = userEvent.setup()
    renderWithProviders(<AddMemberForm groupId="g1" />, { fetch: stub.fetch })

    const input = screen.getByLabelText(/name/i)
    await user.type(input, 'Ana')
    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() => expect(input).toHaveValue(''))
    expect(stub.calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/groups/g1/members',
      body: { name: 'Ana' },
    })
  })

  it('shows DUPLICATE_MEMBER inline and keeps the typed name so the user can edit it', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/members', {
      status: 409,
      body: { error: { code: 'DUPLICATE_MEMBER', message: 'wire message ignored' } },
    })
    const user = userEvent.setup()
    renderWithProviders(<AddMemberForm groupId="g1" />, { fetch: stub.fetch })

    const input = screen.getByLabelText(/name/i)
    await user.type(input, 'Ana')
    await user.click(screen.getByRole('button', { name: /add member/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already has that name/i)
    expect(input).toHaveValue('Ana')
  })
})

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { MemberList } from '../../../../src/web/features/members/MemberList.js'
import type { WireExpense, WireMember } from '../../../../src/web/net/types.js'
import { createFetchStub } from '../../fetchStub.js'
import { createProvidersWrapper } from '../../renderWithProviders.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
]

const EXPENSE_REFERENCING_M1: WireExpense = {
  id: 'e1',
  description: 'Dinner',
  amountCents: 1000,
  paidByMemberId: 'm1',
  date: '2026-09-02T00:00:00.000Z',
  splitMode: 'EQUAL',
  createdAt: '2026-09-02T00:00:00.000Z',
  shares: [{ memberId: 'm1', shareCents: 1000 }],
}

describe('MemberList', () => {
  it('disables Remove with a visible reason for a member referenced by an expense', () => {
    const stub = createFetchStub()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(
      <MemberList groupId="g1" members={MEMBERS} expenses={[EXPENSE_REFERENCING_M1]} />,
      { wrapper: Wrapper },
    )

    const anaRow = screen.getByText('Ana').closest('li')!
    const removeButton = screen.getAllByRole('button', { name: /remove/i })[0]!
    expect(anaRow).toContainElement(removeButton)
    expect(removeButton).toBeDisabled()
    expect(screen.getByText(/on 1 expense/i)).toBeInTheDocument()
  })

  it('leaves Remove enabled for an unreferenced member and removes them on confirm', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1/members/m2', { status: 204 })
    const user = userEvent.setup()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(
      <MemberList groupId="g1" members={MEMBERS} expenses={[EXPENSE_REFERENCING_M1]} />,
      { wrapper: Wrapper },
    )

    const bobRow = screen.getByText('Bob').closest('li')!
    const removeButton = within(bobRow).getByRole('button', { name: 'Remove' })
    expect(removeButton).not.toBeDisabled()

    await user.click(removeButton)
    await user.click(within(bobRow).getByRole('button', { name: /sure/i }))

    await waitFor(() =>
      expect(stub.calls[0]).toMatchObject({
        method: 'DELETE',
        path: '/api/groups/g1/members/m2',
      }),
    )
  })

  it('renders a MEMBER_REFERENCED 409 from a stale-cache race next to that row', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/groups/g1/members/m2', {
      status: 409,
      body: { error: { code: 'MEMBER_REFERENCED', message: 'ignored' } },
    })
    const user = userEvent.setup()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    // Cache says m2 is unreferenced (stale), server disagrees.
    render(<MemberList groupId="g1" members={MEMBERS} expenses={[]} />, {
      wrapper: Wrapper,
    })

    const bobRow = screen.getByText('Bob').closest('li')!
    await user.click(within(bobRow).getByRole('button', { name: 'Remove' }))
    await user.click(within(bobRow).getByRole('button', { name: /sure/i }))

    const alert = await within(bobRow).findByRole('alert')
    expect(alert).toHaveTextContent(/on one or more expenses/i)
  })

  it("keeps other rows enabled while one row's delete is in flight — each row has its own mutation, not one shared across the list", async () => {
    const stub = createFetchStub()
    let resolveAnaDelete: (() => void) | undefined
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveAnaDelete = () => resolve(new Response(null, { status: 204 }))
    })
    const fetchWithHangingAnaDelete: typeof stub.fetch = async (input, init) => {
      const path = typeof input === 'string' ? input : input.toString()
      if (init?.method === 'DELETE' && path === '/api/groups/g1/members/m1') {
        return pendingResponse
      }
      return stub.fetch(input, init)
    }

    const user = userEvent.setup()
    const { Wrapper } = createProvidersWrapper({ fetch: fetchWithHangingAnaDelete })
    render(<MemberList groupId="g1" members={MEMBERS} expenses={[]} />, {
      wrapper: Wrapper,
    })

    const anaRow = screen.getByText('Ana').closest('li')!
    const bobRow = screen.getByText('Bob').closest('li')!

    await user.click(within(anaRow).getByRole('button', { name: 'Remove' }))
    await user.click(within(anaRow).getByRole('button', { name: /sure/i }))
    // Ana's delete is now in flight and will not resolve until we say so.

    // With one mutation shared across the whole list, isPending would be
    // true here for every row, wrongly disabling Bob's button too.
    expect(within(bobRow).getByRole('button', { name: 'Remove' })).not.toBeDisabled()

    resolveAnaDelete?.()
  })

  it('renders an empty state when there are no members', () => {
    const stub = createFetchStub()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(<MemberList groupId="g1" members={[]} expenses={[]} />, { wrapper: Wrapper })

    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })
})

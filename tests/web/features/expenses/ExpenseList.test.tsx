import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ExpenseList } from '../../../../src/web/features/expenses/ExpenseList.js'
import type { WireExpense, WireMember } from '../../../../src/web/net/types.js'
import { createFetchStub } from '../../fetchStub.js'
import { createProvidersWrapper } from '../../renderWithProviders.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
]

const EXPENSES: WireExpense[] = [
  {
    id: 'e1',
    description: 'Dinner',
    amountCents: 8450,
    paidByMemberId: 'm1',
    date: '2026-09-02T00:00:00.000Z',
    splitMode: 'EQUAL',
    createdAt: '2026-09-02T00:00:00.000Z',
    shares: [
      { memberId: 'm1', shareCents: 4225 },
      { memberId: 'm2', shareCents: 4225 },
    ],
  },
]

describe('ExpenseList', () => {
  it('renders each expense in the order given, with description, payer, date and amount', () => {
    const stub = createFetchStub()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(<ExpenseList groupId="g1" expenses={EXPENSES} members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    expect(screen.getByText('Dinner')).toBeInTheDocument()
    const row = screen.getByText('Dinner').closest('li')!
    expect(row).toHaveTextContent('Ana')
    expect(row).toHaveTextContent('2026-09-02')
    expect(row).toHaveTextContent('84.50 USD')
  })

  it('expands to show per-member shares', async () => {
    const stub = createFetchStub()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    const user = userEvent.setup()
    render(<ExpenseList groupId="g1" expenses={EXPENSES} members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    await user.click(screen.getByRole('button', { name: /details/i }))

    expect(screen.getAllByText(/42\.25/)).toHaveLength(2) // Ana's and Bob's shares
  })

  it('deletes an expense on confirm', async () => {
    const stub = createFetchStub()
    stub.queueResponse('DELETE', '/api/expenses/e1', { status: 204 })
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    const user = userEvent.setup()
    render(<ExpenseList groupId="g1" expenses={EXPENSES} members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    const row = screen.getByText('Dinner').closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Delete' }))
    await user.click(within(row).getByRole('button', { name: /sure/i }))

    await waitFor(() => expect(stub.calls[0]).toMatchObject({ method: 'DELETE', path: '/api/expenses/e1' }))
  })

  it('renders an empty state when there are no expenses', () => {
    const stub = createFetchStub()
    const { Wrapper } = createProvidersWrapper({ fetch: stub.fetch })
    render(<ExpenseList groupId="g1" expenses={[]} members={MEMBERS} currency="USD" />, { wrapper: Wrapper })

    expect(screen.getByText(/no expenses yet/i)).toBeInTheDocument()
  })
})

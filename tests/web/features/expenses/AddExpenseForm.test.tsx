import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AddExpenseForm } from '../../../../src/web/features/expenses/AddExpenseForm.js'
import type { WireMember } from '../../../../src/web/net/types.js'
import { createFetchStub } from '../../fetchStub.js'
import { renderWithProviders } from '../../renderWithProviders.js'

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
  { id: 'm3', name: 'Cy' },
]

function renderForm(fetch: ReturnType<typeof createFetchStub>['fetch']) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/groups/:groupId/expenses/new"
        element={<AddExpenseForm groupId="g1" members={MEMBERS} />}
      />
      <Route path="/groups/:groupId" element={<div>Group detail page</div>} />
    </Routes>,
    { fetch, initialEntries: ['/groups/g1/expenses/new'] },
  )
}

async function fillCommonFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/description/i), 'Dinner')
  await user.type(screen.getByLabelText(/^amount/i), '84.50')
  await user.selectOptions(screen.getByLabelText(/paid by/i), 'm1')
  fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-09-02' } })
}

describe('AddExpenseForm', () => {
  it('submits an EQUAL split across every member by default, with the exact POST body', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/expenses', {
      status: 201,
      body: { id: 'e1' },
    })
    const user = userEvent.setup()
    renderForm(stub.fetch)

    await fillCommonFields(user)
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    await waitFor(() => expect(screen.getByText('Group detail page')).toBeInTheDocument())
    expect(stub.calls[0]).toMatchObject({
      method: 'POST',
      path: '/api/groups/g1/expenses',
      body: {
        description: 'Dinner',
        amountCents: 8450,
        paidByMemberId: 'm1',
        date: '2026-09-02',
        split: { mode: 'EQUAL', memberIds: ['m1', 'm2', 'm3'] },
      },
    })
  })

  it('renders the live allocation preview using formatCents, showing the largest-remainder split', async () => {
    // 8450 cents across 3 members: 8450/3 = 2816.67 -> 2817/2817/2816 by
    // largest remainder, ties broken by member id (m1 < m2 < m3).
    const stub = createFetchStub()
    const user = userEvent.setup()
    renderForm(stub.fetch)

    await fillCommonFields(user)

    expect(screen.getByText(/Ana: 28\.17/)).toBeInTheDocument()
    expect(screen.getByText(/Bob: 28\.17/)).toBeInTheDocument()
    expect(screen.getByText(/Cy: 28\.16/)).toBeInTheDocument()
  })

  it('disables submit with a visible reason while an EXACT split is unbalanced', async () => {
    const stub = createFetchStub()
    const user = userEvent.setup()
    renderForm(stub.fetch)

    await fillCommonFields(user)
    await user.click(screen.getByRole('radio', { name: 'EXACT' }))
    await user.type(screen.getByLabelText('Ana amount'), '50.00')
    // Bob and Cy left unentered — the split is unbalanced.

    const submit = screen.getByRole('button', { name: /add expense/i })
    expect(submit).toBeDisabled()
    expect(screen.getByText(/left to assign/i)).toBeInTheDocument()
  })

  it('renders a 422 and preserves every field rather than clearing the form', async () => {
    const stub = createFetchStub()
    stub.queueResponse('POST', '/api/groups/g1/expenses', {
      status: 422,
      body: { error: { code: 'MEMBER_NOT_IN_GROUP', message: 'ignored' } },
    })
    const user = userEvent.setup()
    renderForm(stub.fetch)

    await fillCommonFields(user)
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toHaveValue('Dinner')
    expect(screen.getByLabelText(/^amount/i)).toHaveValue('84.50')
  })
})

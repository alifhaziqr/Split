/**
 * M5's own named end-to-end verification — the milestone analogue of
 * tests/server/api/endToEnd.test.ts. Renders the real <App/> against a real
 * migrated temp SQLite database (through the real Hono app, not a scripted
 * fetch stub — see contractLive.test.ts's own reasoning: this proves the
 * whole stack, client through server through database, not one layer of it
 * against hand-scripted responses that could silently drift from reality).
 *
 * Walks the actual UI: create a group, add three members, record two
 * EQUAL-split expenses paid by different members, and confirm the
 * settle-up section shows the exact transfers that zero every balance —
 * applied by hand below, the same verification M4's endToEnd test performs
 * for the API directly.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../src/server/app.js'
import { App } from '../../../src/web/App.js'
import type { FetchLike } from '../../../src/web/net/http.js'
import type { TestDatabase } from '../../server/db/testDb.js'
import { createTestDatabase, resetDb } from '../../server/db/testDb.js'
import { createProvidersWrapper } from '../renderWithProviders.js'

let ctx: TestDatabase
let app: ReturnType<typeof createApp>

beforeAll(() => {
  ctx = createTestDatabase()
  app = createApp(ctx.db)
}, 60_000) // real `prisma migrate deploy` subprocess — see vitest.config.ts's `node` project comment for why 60s

afterAll(async () => {
  await ctx.cleanup()
})

beforeEach(async () => {
  await resetDb(ctx.db)
})

function renderAppAgainstRealServer() {
  const fetchViaApp: FetchLike = async (input, init) => app.request(input as string, init)
  const { Wrapper } = createProvidersWrapper({
    fetch: fetchViaApp,
    initialEntries: ['/'],
  })
  return render(<App />, { wrapper: Wrapper })
}

describe('add-expense flow, end to end', () => {
  it('creates a group, adds three members, records two mixed-payer expenses, and settles up to exactly zero', async () => {
    const user = userEvent.setup()
    renderAppAgainstRealServer()

    // 1. Create the group.
    await user.type(screen.getByLabelText(/name/i), 'Trip')
    await user.type(screen.getByLabelText(/currency/i), 'USD')
    await user.click(screen.getByRole('button', { name: /create group/i }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Trip' })).toBeInTheDocument(),
    )

    // 2. Add three members.
    for (const name of ['Ana', 'Bob', 'Cy']) {
      await user.type(screen.getByLabelText(/^name$/i), name)
      await user.click(screen.getByRole('button', { name: /add member/i }))
      await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument())
    }

    // 3. Expense 1: Ana pays 9.00, split EQUAL across all three (300 each).
    await user.click(screen.getByRole('link', { name: /add expense/i }))
    await waitFor(() => expect(screen.getByLabelText(/paid by/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/description/i), 'Dinner')
    await user.type(screen.getByLabelText(/^amount/i), '9.00')
    await user.selectOptions(screen.getByLabelText(/paid by/i), 'Ana')
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-09-02' } })
    await user.click(screen.getByRole('button', { name: /add expense/i }))
    await waitFor(() => expect(screen.getByText('Dinner')).toBeInTheDocument())

    // 4. Expense 2: Bob pays 3.00, split EQUAL across all three (100 each).
    await user.click(screen.getByRole('link', { name: /add expense/i }))
    await waitFor(() => expect(screen.getByLabelText(/paid by/i)).toBeInTheDocument())
    await user.type(screen.getByLabelText(/description/i), 'Coffee')
    await user.type(screen.getByLabelText(/^amount/i), '3.00')
    await user.selectOptions(screen.getByLabelText(/paid by/i), 'Bob')
    fireEvent.change(screen.getByLabelText(/date/i), { target: { value: '2026-09-02' } })
    await user.click(screen.getByRole('button', { name: /add expense/i }))
    await waitFor(() => expect(screen.getByText('Coffee')).toBeInTheDocument())

    // Hand-applied balances (the same check M4's endToEnd.test.ts performs
    // for the API directly): Ana paid 900, owes 300+100=400 -> net +500.
    // Bob paid 300, owes 300+100=400 -> net -100. Cy paid 0, owes 400 -> -400.
    // Sum: 500 - 100 - 400 = 0. simplifyDebts's greedy largest-vs-largest
    // pairing settles it in exactly two payments: Cy pays Ana 400 (zeroing
    // Cy), then Bob pays Ana 100 (zeroing both).
    // toHaveTextContent concatenates all descendant text (Money renders its
    // amount in a nested <span>), so scoping to the settle-up section and
    // asserting substrings avoids needing a unique getByText match.
    const settleSection = screen
      .getByRole('heading', { name: 'Settle up' })
      .closest('section')
    await waitFor(() => expect(settleSection).toHaveTextContent('Cy pays Ana 4.00 USD'))
    expect(settleSection).toHaveTextContent('Bob pays Ana 1.00 USD')
    // And the balances list agrees before any transfer is applied.
    expect(settleSection).toHaveTextContent('Ana is owed 5.00 USD')
    expect(settleSection).toHaveTextContent('Bob owes 1.00 USD')
    expect(settleSection).toHaveTextContent('Cy owes 4.00 USD')
  }, 20_000) // many userEvent interactions plus real DB round trips — vitest's 5s default testTimeout is too tight
})

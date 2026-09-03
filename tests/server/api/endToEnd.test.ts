/**
 * This milestone's single named acceptance check, quoted verbatim from
 * docs/superpowers/specs/2026-09-01-split-design.md's "Verification" section:
 * "The end-to-end check is a seeded group of four with five mixed-mode
 * expenses, where the settle-up transfers are applied by hand and confirmed
 * to zero every balance." The same document's "Known hard cases" section
 * separately names two cases this test also exercises directly: a 100-cent
 * three-way split (must be 34/33/33, never 33/33/33) and an expense whose
 * payer is not among its own participants.
 *
 * Driven entirely through the real HTTP surface (`app.request`) against a
 * real migrated temp SQLite database — never by calling db/core functions
 * directly — so this test proves the whole stack, not just one layer of it.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ExpenseDto, GroupDto, MemberDto } from '../../../src/server/api/dto.js'
import { createApp } from '../../../src/server/app.js'
import type { Settlement } from '../../../src/server/settlement.js'
import type { TestDatabase } from '../db/testDb.js'
import { createTestDatabase, resetDb } from '../db/testDb.js'
import { createHttpClient, readError, readJson } from './httpTestHelpers.js'

let ctx: TestDatabase
let app: ReturnType<typeof createApp>

beforeAll(() => {
  ctx = createTestDatabase()
  app = createApp(ctx.db)
})

afterAll(async () => {
  await ctx.cleanup()
})

beforeEach(async () => {
  await resetDb(ctx.db)
})

const { postJson, del } = createHttpClient(() => app)

async function createGroupOk(name: string, currency: string): Promise<GroupDto> {
  const res = await postJson('/api/groups', { name, currency })
  expect(res.status).toBe(201)
  return (await readJson(res)) as GroupDto
}

async function addMemberOk(groupId: string, name: string): Promise<MemberDto> {
  const res = await postJson(`/api/groups/${groupId}/members`, { name })
  expect(res.status).toBe(201)
  return (await readJson(res)) as MemberDto
}

async function createExpenseOk(groupId: string, body: unknown): Promise<ExpenseDto> {
  const res = await postJson(`/api/groups/${groupId}/expenses`, body)
  expect(res.status).toBe(201)
  return (await readJson(res)) as ExpenseDto
}

describe('end-to-end: seeded group of four, five mixed-mode expenses, settle-up, teardown', () => {
  it('zeroes every balance once every settlement transfer is applied by hand', async () => {
    // 1. One group, exactly four members.
    const group = await createGroupOk('Cabin Weekend', 'USD')
    const ana = await addMemberOk(group.id, 'Ana')
    const bo = await addMemberOk(group.id, 'Bo')
    const cy = await addMemberOk(group.id, 'Cy')
    const dee = await addMemberOk(group.id, 'Dee')

    // 2a. EQUAL across all four members.
    const equalExpense = await createExpenseOk(group.id, {
      description: 'Groceries',
      amountCents: 1000,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id, bo.id, cy.id, dee.id] },
    })
    expect(equalExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000)

    // 2b. EXACT — hand-picked cents summing exactly to the amount.
    const exactExpense = await createExpenseOk(group.id, {
      description: 'Firewood',
      amountCents: 900,
      paidByMemberId: bo.id,
      date: '2026-01-02T00:00:00.000Z',
      split: {
        mode: 'EXACT',
        shares: [
          { memberId: ana.id, shareCents: 400 },
          { memberId: bo.id, shareCents: 300 },
          { memberId: cy.id, shareCents: 150 },
          { memberId: dee.id, shareCents: 50 },
        ],
      },
    })
    expect(exactExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(900)

    // 2c. PERCENT — basis points summing exactly to 10000.
    const percentExpense = await createExpenseOk(group.id, {
      description: 'Cabin rental',
      amountCents: 733,
      paidByMemberId: cy.id,
      date: '2026-01-03T00:00:00.000Z',
      split: {
        mode: 'PERCENT',
        shares: [
          { memberId: ana.id, percentBp: 2500 },
          { memberId: bo.id, percentBp: 2500 },
          { memberId: cy.id, percentBp: 2500 },
          { memberId: dee.id, percentBp: 2500 },
        ],
      },
    })
    expect(percentExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(733)

    // 2d. SHARES — integer weights.
    const sharesExpense = await createExpenseOk(group.id, {
      description: 'Gas',
      amountCents: 777,
      paidByMemberId: dee.id,
      date: '2026-01-04T00:00:00.000Z',
      split: {
        mode: 'SHARES',
        shares: [
          { memberId: ana.id, weight: 1 },
          { memberId: bo.id, weight: 2 },
          { memberId: cy.id, weight: 3 },
          { memberId: dee.id, weight: 4 },
        ],
      },
    })
    expect(sharesExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(777)

    // 2e. Hard case #1 (payer not among participants) AND hard case #2
    // (100 cents split three ways must be 34/33/33, never 33/33/33) combined
    // in one expense: Dee pays but is deliberately excluded from the
    // three-member EQUAL split.
    const oddSplitExpense = await createExpenseOk(group.id, {
      description: 'Ice for the cooler',
      amountCents: 100,
      paidByMemberId: dee.id,
      date: '2026-01-05T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id, bo.id, cy.id] },
    })

    // Hard case: payer excluded from its own expense's participants.
    expect(oddSplitExpense.paidByMemberId).toBe(dee.id)
    expect(oddSplitExpense.shares.map((s) => s.memberId)).not.toContain(dee.id)
    expect(oddSplitExpense.shares).toHaveLength(3)

    // Hard case: 100 cents three ways is 34/33/33, never 33/33/33 — assert
    // directly on this expense's own response body, right after creating it.
    const oddShares = oddSplitExpense.shares
      .map((s) => s.shareCents)
      .sort((a, b) => b - a)
    expect(oddShares).toEqual([34, 33, 33])
    expect(oddSplitExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(100)

    // 3. GET the group's settlement.
    const settlementRes = await app.request(`/api/groups/${group.id}/settlement`)
    expect(settlementRes.status).toBe(200)
    const settlement = (await readJson(settlementRes)) as Settlement

    expect(settlement.balances).toHaveLength(4)
    expect(settlement.balances.reduce((sum, b) => sum + b.balanceCents, 0)).toBe(0)

    // 5. At most n-1 = 3 payments, and nobody both pays and receives.
    expect(settlement.transfers.length).toBeLessThanOrEqual(3)
    const fromIds = new Set(settlement.transfers.map((t) => t.fromMemberId))
    const toIds = new Set(settlement.transfers.map((t) => t.toMemberId))
    for (const id of fromIds) {
      expect(toIds.has(id)).toBe(false)
    }

    // 4. Apply every transfer by hand. Per core/settle.ts's own doc comments,
    // a positive balance means the group owes that member money, and a
    // Transfer moves amountCents from a debtor (fromMemberId) to a creditor
    // (toMemberId) — so applying it ADDS to the payer's running balance
    // (their debt shrinks toward zero, i.e. balance rises) and SUBTRACTS
    // from the receiver's running balance (their credit shrinks toward
    // zero, i.e. balance falls).
    const running = new Map(settlement.balances.map((b) => [b.memberId, b.balanceCents]))
    for (const transfer of settlement.transfers) {
      expect(transfer.amountCents).toBeGreaterThan(0)
      expect(transfer.fromMemberId).not.toBe(transfer.toMemberId)
      running.set(
        transfer.fromMemberId,
        (running.get(transfer.fromMemberId) ?? 0) + transfer.amountCents,
      )
      running.set(
        transfer.toMemberId,
        (running.get(transfer.toMemberId) ?? 0) - transfer.amountCents,
      )
    }
    expect(running.size).toBe(4)
    for (const balance of running.values()) {
      expect(balance).toBe(0)
    }

    // 6. Dismantle the group in the only order the foreign keys permit.
    const allExpenses = [
      equalExpense,
      exactExpense,
      percentExpense,
      sharesExpense,
      oddSplitExpense,
    ]
    const allMembers = [ana, bo, cy, dee]

    const earlyDeleteRes = await del(`/api/groups/${group.id}`)
    expect(earlyDeleteRes.status).toBe(409)
    expect((await readError(earlyDeleteRes)).error.code).toBe('GROUP_NOT_EMPTY')

    // The group, its expenses, and its members must all still be there.
    const stillThereRes = await app.request(`/api/groups/${group.id}`)
    expect(stillThereRes.status).toBe(200)

    for (const expense of allExpenses) {
      const res = await del(`/api/expenses/${expense.id}`)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }

    for (const member of allMembers) {
      const res = await del(`/api/groups/${group.id}/members/${member.id}`)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }

    const groupDeleteRes = await del(`/api/groups/${group.id}`)
    expect(groupDeleteRes.status).toBe(204)
    expect(await groupDeleteRes.text()).toBe('')

    const finalGetRes = await app.request(`/api/groups/${group.id}`)
    expect(finalGetRes.status).toBe(404)
  })
})

/**
 * One shared test file for all four resource route groups (groups, members,
 * expenses, settlement) rather than four files mirroring src/ under
 * tests/server/api/routes/ — this is the first test file in the milestone
 * that talks to a real database, and each such file would spawn its own
 * real `prisma migrate deploy` subprocess (multiple seconds) purely for the
 * route layer, which isn't worth paying four times over.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../../../src/server/app.js'
import type { ExpenseDto, GroupDetailsDto, GroupDto, MemberDto } from '../../../src/server/api/dto.js'
import type { Settlement } from '../../../src/server/settlement.js'
import { createTestDatabase, resetDb } from '../db/testDb.js'
import type { TestDatabase } from '../db/testDb.js'
import { createHttpClient, JSON_HEADERS, readError, readJson } from './httpTestHelpers.js'

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

async function createGroup(name = 'Trip', currency = 'USD'): Promise<GroupDto> {
  const res = await postJson('/api/groups', { name, currency })
  return (await readJson(res)) as GroupDto
}

async function addMember(groupId: string, name: string): Promise<Response> {
  return postJson(`/api/groups/${groupId}/members`, { name })
}

async function addMemberOk(groupId: string, name: string): Promise<MemberDto> {
  const res = await addMember(groupId, name)
  return (await readJson(res)) as MemberDto
}

describe('groups routes', () => {
  it('creates a group and returns its DTO with a 201', async () => {
    const res = await postJson('/api/groups', { name: 'Roommates', currency: 'EUR' })

    expect(res.status).toBe(201)
    const group = (await readJson(res)) as GroupDto
    expect(group.name).toBe('Roommates')
    expect(group.currency).toBe('EUR')
    expect(group.id).toEqual(expect.any(String))
    expect(group.createdAt).toEqual(expect.any(String))
  })

  it('lists groups in listGroups own deterministic order, unmodified', async () => {
    const a = await createGroup('Alpha', 'EUR')
    const b = await createGroup('Beta', 'EUR')

    const res = await app.request('/api/groups')
    expect(res.status).toBe(200)
    const body = (await readJson(res)) as { groups: GroupDto[] }

    const ids = body.groups.map((g) => g.id)
    expect(new Set(ids)).toEqual(new Set([a.id, b.id]))

    const again = (await readJson(await app.request('/api/groups'))) as { groups: GroupDto[] }
    expect(again.groups.map((g) => g.id)).toEqual(ids)
  })

  it('returns 404 fetching a group that does not exist', async () => {
    const res = await app.request('/api/groups/nonexistent-group')
    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('returns 404 deleting a group that does not exist', async () => {
    const res = await del('/api/groups/nonexistent-group')
    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('returns 409 deleting a group that still has a member', async () => {
    const group = await createGroup()
    await addMemberOk(group.id, 'Ana')

    const res = await del(`/api/groups/${group.id}`)

    expect(res.status).toBe(409)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_EMPTY')
  })

  it('returns 409 deleting a group that still has an expense', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 500,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id] },
    })

    const res = await del(`/api/groups/${group.id}`)

    expect(res.status).toBe(409)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_EMPTY')
  })

  it('returns 400 for a group body that fails schema validation', async () => {
    const res = await postJson('/api/groups', { name: 'Missing currency' })

    expect(res.status).toBe(400)
    expect((await readError(res)).error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 400 for a body that is not syntactically valid JSON', async () => {
    const res = await app.request('/api/groups', {
      method: 'POST',
      headers: JSON_HEADERS,
      body: '{ this is not json',
    })

    expect(res.status).toBe(400)
    expect((await readError(res)).error.code).toBe('MALFORMED_JSON')
  })

  it('returns the app.notFound shape for a route that does not exist', async () => {
    const res = await app.request('/api/this-route-does-not-exist')

    expect(res.status).toBe(404)
    expect(await readJson(res)).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  it('runs the full group lifecycle: members, all four split modes, fetch, settle, then teardown in FK order', async () => {
    const group = await createGroup('Lisbon Trip', 'EUR')

    // Added out of alphabetical order to make the members-sorted-by-name
    // assertion below a real check, not an accident of insertion order.
    const cy = await addMemberOk(group.id, 'Cy')
    const ana = await addMemberOk(group.id, 'Ana')
    const bo = await addMemberOk(group.id, 'Bo')

    // Posted out of date order too, so the expenses-sorted-by-date-desc
    // assertion below actually exercises the sort rather than passing by
    // coincidence of insertion order.
    const sharesExpenseRes = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Rental car',
      amountCents: 900,
      paidByMemberId: ana.id,
      date: '2026-01-04T00:00:00.000Z',
      split: {
        mode: 'SHARES',
        shares: [
          { memberId: ana.id, weight: 1 },
          { memberId: bo.id, weight: 2 },
        ],
      },
    })
    const equalExpenseRes = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 300,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id, bo.id, cy.id] },
    })
    const percentExpenseRes = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Hotel',
      amountCents: 1000,
      paidByMemberId: cy.id,
      date: '2026-01-03T00:00:00.000Z',
      split: {
        mode: 'PERCENT',
        shares: [
          { memberId: ana.id, percentBp: 5000 },
          { memberId: bo.id, percentBp: 3000 },
          { memberId: cy.id, percentBp: 2000 },
        ],
      },
    })
    const exactExpenseRes = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Groceries',
      amountCents: 1000,
      paidByMemberId: bo.id,
      date: '2026-01-02T00:00:00.000Z',
      split: {
        mode: 'EXACT',
        shares: [
          { memberId: ana.id, shareCents: 400 },
          { memberId: bo.id, shareCents: 600 },
        ],
      },
    })

    for (const res of [sharesExpenseRes, equalExpenseRes, percentExpenseRes, exactExpenseRes]) {
      expect(res.status).toBe(201)
    }
    const sharesExpense = (await readJson(sharesExpenseRes)) as ExpenseDto
    const equalExpense = (await readJson(equalExpenseRes)) as ExpenseDto
    const percentExpense = (await readJson(percentExpenseRes)) as ExpenseDto
    const exactExpense = (await readJson(exactExpenseRes)) as ExpenseDto
    expect(equalExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(300)
    expect(exactExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000)
    expect(percentExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(1000)
    expect(sharesExpense.shares.reduce((sum, s) => sum + s.shareCents, 0)).toBe(900)

    const detailsRes = await app.request(`/api/groups/${group.id}`)
    expect(detailsRes.status).toBe(200)
    const details = (await readJson(detailsRes)) as GroupDetailsDto

    expect(details.name).toBe('Lisbon Trip')
    expect(details.members.map((m) => m.name)).toEqual(['Ana', 'Bo', 'Cy'])
    expect(details.expenses.map((e) => e.description)).toEqual(['Rental car', 'Hotel', 'Groceries', 'Dinner'])

    const settlementRes = await app.request(`/api/groups/${group.id}/settlement`)
    expect(settlementRes.status).toBe(200)
    const settlement = (await readJson(settlementRes)) as Settlement

    expect(settlement.balances).toHaveLength(3)
    expect(settlement.balances.reduce((sum, b) => sum + b.balanceCents, 0)).toBe(0)
    expect(settlement.transfers.length).toBeLessThanOrEqual(2)

    // Apply every transfer by hand and confirm it zeroes every balance —
    // an invariant check rather than pinning the greedy algorithm's exact
    // choice of payments (see CLAUDE.md's M2 note on simplifyDebts).
    const running = new Map(settlement.balances.map((b) => [b.memberId, b.balanceCents]))
    for (const transfer of settlement.transfers) {
      running.set(transfer.fromMemberId, (running.get(transfer.fromMemberId) ?? 0) + transfer.amountCents)
      running.set(transfer.toMemberId, (running.get(transfer.toMemberId) ?? 0) - transfer.amountCents)
      expect(transfer.amountCents).toBeGreaterThan(0)
      expect(transfer.fromMemberId).not.toBe(transfer.toMemberId)
    }
    for (const balance of running.values()) {
      expect(balance).toBe(0)
    }

    // Teardown in the only order the foreign keys actually permit: every
    // expense, then every member, then the group itself.
    for (const expense of [sharesExpense, equalExpense, percentExpense, exactExpense]) {
      const res = await del(`/api/expenses/${expense.id}`)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }
    for (const member of [ana, bo, cy]) {
      const res = await del(`/api/groups/${group.id}/members/${member.id}`)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    }
    const groupDeleteRes = await del(`/api/groups/${group.id}`)
    expect(groupDeleteRes.status).toBe(204)
    expect(await groupDeleteRes.text()).toBe('')

    expect((await app.request(`/api/groups/${group.id}`)).status).toBe(404)
  })
})

describe('members routes', () => {
  it('adds a member and returns its DTO with a 201', async () => {
    const group = await createGroup()

    const res = await addMember(group.id, 'Ana')

    expect(res.status).toBe(201)
    const member = (await readJson(res)) as MemberDto
    expect(member.name).toBe('Ana')
    expect(member.id).toEqual(expect.any(String))
  })

  it('returns 404 adding a member to a group that does not exist', async () => {
    const res = await addMember('nonexistent-group', 'Ana')

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('rejects a malformed body before checking the group exists, even for a bogus group', async () => {
    // Cheap, in-memory body validation should never wait on a DB round trip
    // it doesn't need — a garbage body is rejected the same way regardless
    // of whether the groupId in the URL happens to be real.
    const res = await addMember('nonexistent-group', '')

    expect(res.status).toBe(400)
    expect((await readError(res)).error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 409 for a duplicate member name in the same group', async () => {
    const group = await createGroup()
    await addMemberOk(group.id, 'Ana')

    const res = await addMember(group.id, 'Ana')

    expect(res.status).toBe(409)
    expect((await readError(res)).error.code).toBe('DUPLICATE_MEMBER')
  })

  it('returns 409 deleting a member still referenced by an expense', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 500,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id] },
    })

    const res = await del(`/api/groups/${group.id}/members/${ana.id}`)

    expect(res.status).toBe(409)
    expect((await readError(res)).error.code).toBe('MEMBER_REFERENCED')
  })

  it('returns 404 with GROUP_NOT_FOUND deleting a member via a group that does not exist', async () => {
    // Distinct from "scoped through a group it does not belong to" below: here
    // the group itself is bogus, so the error should name the group, not the
    // member, matching every other groupId-scoped route's behavior.
    const res = await del('/api/groups/nonexistent-group/members/nonexistent-member')

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('returns 404 deleting a member scoped through a group it does not belong to', async () => {
    const groupA = await createGroup('Group A')
    const groupB = await createGroup('Group B')
    const memberOfB = await addMemberOk(groupB.id, 'Intruder')

    // memberOfB exists, but not inside groupA — from groupA's URL this must
    // look exactly like a member that doesn't exist at all.
    const res = await del(`/api/groups/${groupA.id}/members/${memberOfB.id}`)

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('MEMBER_NOT_FOUND')

    // And the member must still exist, unharmed, in its real group.
    const stillThere = await app.request(`/api/groups/${groupB.id}`)
    const details = (await readJson(stillThere)) as GroupDetailsDto
    expect(details.members.map((m) => m.id)).toContain(memberOfB.id)
  })
})

describe('expenses routes', () => {
  it('returns 404 creating an expense against a group that does not exist', async () => {
    const res = await postJson('/api/groups/nonexistent-group/expenses', {
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: 'whoever',
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: ['whoever'] },
    })

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('rejects a malformed body before checking the group exists, even for a bogus group', async () => {
    const res = await postJson('/api/groups/nonexistent-group/expenses', { description: '' })

    expect(res.status).toBe(400)
    expect((await readError(res)).error.code).toBe('VALIDATION_FAILED')
  })

  it('returns 422 for a PERCENT split whose basis points do not sum to 10000', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    const bo = await addMemberOk(group.id, 'Bo')

    const res = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: {
        mode: 'PERCENT',
        shares: [
          { memberId: ana.id, percentBp: 5000 },
          { memberId: bo.id, percentBp: 4000 },
        ],
      },
    })

    expect(res.status).toBe(422)
    expect((await readError(res)).error.code).toBe('INVALID_SPLIT')
  })

  it('returns 422 for an expense naming a participant from a different group', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    const otherGroup = await createGroup('Other')
    const outsider = await addMemberOk(otherGroup.id, 'Outsider')

    const res = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id, outsider.id] },
    })

    expect(res.status).toBe(422)
    expect((await readError(res)).error.code).toBe('MEMBER_NOT_IN_GROUP')
  })

  it('returns 204 with an empty body deleting an expense', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    const created = await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Dinner',
      amountCents: 500,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id] },
    })
    const expense = (await readJson(created)) as ExpenseDto

    const res = await del(`/api/expenses/${expense.id}`)

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('returns 404 deleting an expense that does not exist', async () => {
    const res = await del('/api/expenses/nonexistent-expense')

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('EXPENSE_NOT_FOUND')
  })
})

describe('settlement route', () => {
  it('returns 404 for a group that does not exist', async () => {
    const res = await app.request('/api/groups/nonexistent-group/settlement')

    expect(res.status).toBe(404)
    expect((await readError(res)).error.code).toBe('GROUP_NOT_FOUND')
  })

  it('seeds a zero balance for a member with no expense activity yet', async () => {
    const group = await createGroup()
    const ana = await addMemberOk(group.id, 'Ana')
    await addMemberOk(group.id, 'Bo')
    await postJson(`/api/groups/${group.id}/expenses`, {
      description: 'Solo purchase',
      amountCents: 500,
      paidByMemberId: ana.id,
      date: '2026-01-01T00:00:00.000Z',
      split: { mode: 'EQUAL', memberIds: [ana.id] },
    })

    const res = await app.request(`/api/groups/${group.id}/settlement`)
    const settlement = (await readJson(res)) as Settlement

    expect(settlement.balances).toHaveLength(2)
    const bosBalance = settlement.balances.find((b) => b.memberId !== ana.id)
    expect(bosBalance?.balanceCents).toBe(0)
  })
})

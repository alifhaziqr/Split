import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createExpense } from '../../../src/server/db/expenses.js'
import {
  createGroup,
  deleteGroup,
  getGroupWithDetails,
  GroupNotEmptyError,
  GroupNotFoundError,
  listGroups,
} from '../../../src/server/db/groups.js'
import { addMember } from '../../../src/server/db/members.js'
import { createTestDatabase, resetDb } from './testDb.js'
import type { TestDatabase } from './testDb.js'

let ctx: TestDatabase

beforeAll(() => {
  ctx = createTestDatabase()
})

afterAll(async () => {
  await ctx.cleanup()
})

beforeEach(async () => {
  await resetDb(ctx.db)
})

describe('createGroup', () => {
  it('persists a group with the given name and currency', async () => {
    const group = await createGroup(ctx.db, { name: 'Trip to Lisbon', currency: 'USD' })

    expect(group.name).toBe('Trip to Lisbon')
    expect(group.currency).toBe('USD')
    expect(group.id).toEqual(expect.any(String))
  })
})

describe('getGroupWithDetails', () => {
  it('returns null for a group that does not exist', async () => {
    expect(await getGroupWithDetails(ctx.db, 'nonexistent')).toBeNull()
  })

  it('returns a freshly created group with empty members and expenses', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })

    const details = await getGroupWithDetails(ctx.db, group.id)

    expect(details?.name).toBe('Roommates')
    expect(details?.members).toEqual([])
    expect(details?.expenses).toEqual([])
  })

  it('includes members added to the group', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    await ctx.db.member.create({ data: { groupId: group.id, name: 'Ana' } })

    const details = await getGroupWithDetails(ctx.db, group.id)

    expect(details?.members).toHaveLength(1)
    expect(details?.members[0]?.name).toBe('Ana')
  })
})

describe('listGroups', () => {
  it('returns an empty array on an empty database', async () => {
    expect(await listGroups(ctx.db)).toEqual([])
  })

  it('returns every group', async () => {
    await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    await createGroup(ctx.db, { name: 'Trip', currency: 'USD' })

    const groups = await listGroups(ctx.db)

    expect(groups.map((g) => g.name).sort()).toEqual(['Roommates', 'Trip'])
  })

  it('returns the same order across repeated calls', async () => {
    const a = await createGroup(ctx.db, { name: 'Alpha', currency: 'EUR' })
    const b = await createGroup(ctx.db, { name: 'Beta', currency: 'EUR' })
    const c = await createGroup(ctx.db, { name: 'Gamma', currency: 'EUR' })

    const first = await listGroups(ctx.db)
    const second = await listGroups(ctx.db)

    expect(first.map((g) => g.id)).toEqual(second.map((g) => g.id))
    expect(new Set(first.map((g) => g.id))).toEqual(new Set([a.id, b.id, c.id]))
  })

  it('breaks a createdAt tie by id ascending, not by insertion order', async () => {
    // SQLite's CURRENT_TIMESTAMP default has whole-second resolution, so
    // several groups created within one request can genuinely share a
    // createdAt in production — pin all three to the same value here to
    // force that tie deterministically. Ids are assigned in an order that
    // deliberately REVERSES insertion order, so a test that passed merely
    // because cuids happen to be roughly monotonic would fail here: only an
    // explicit `id asc` tiebreaker makes this assertion hold.
    const tiedCreatedAt = new Date('2026-01-01T00:00:00.000Z')
    await ctx.db.group.create({ data: { id: 'group-c', name: 'C', currency: 'EUR', createdAt: tiedCreatedAt } })
    await ctx.db.group.create({ data: { id: 'group-a', name: 'A', currency: 'EUR', createdAt: tiedCreatedAt } })
    await ctx.db.group.create({ data: { id: 'group-b', name: 'B', currency: 'EUR', createdAt: tiedCreatedAt } })

    const groups = await listGroups(ctx.db)

    expect(groups.map((g) => g.id)).toEqual(['group-a', 'group-b', 'group-c'])
  })
})

describe('deleteGroup', () => {
  it('deletes a group with no members or expenses', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })

    await deleteGroup(ctx.db, group.id)

    expect(await ctx.db.group.count()).toBe(0)
  })

  it('rejects deleting a group that still has a member, leaving it in place', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    await addMember(ctx.db, group.id, 'Ana')

    await expect(deleteGroup(ctx.db, group.id)).rejects.toThrow(GroupNotEmptyError)

    expect(await ctx.db.group.findUnique({ where: { id: group.id } })).not.toBeNull()
  })

  it('rejects deleting a group that still has an expense, leaving it in place', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    const payer = await addMember(ctx.db, group.id, 'Ana')
    await createExpense(ctx.db, {
      groupId: group.id,
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: payer.id,
      date: new Date(),
      split: { mode: 'EQUAL', memberIds: [payer.id] },
    })

    await expect(deleteGroup(ctx.db, group.id)).rejects.toThrow(GroupNotEmptyError)

    expect(await ctx.db.group.findUnique({ where: { id: group.id } })).not.toBeNull()
  })

  it('rejects deleting a group that does not exist', async () => {
    await expect(deleteGroup(ctx.db, 'nonexistent-group')).rejects.toThrow(GroupNotFoundError)
  })
})

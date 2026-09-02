import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createGroup } from '../../../src/server/db/groups.js'
import { addMember } from '../../../src/server/db/members.js'
import { createExpense, deleteExpense, ExpenseNotFoundError } from '../../../src/server/db/expenses.js'
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

async function seedGroupOfThree(): Promise<{ groupId: string; memberIds: string[] }> {
  const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
  const a = await addMember(ctx.db, group.id, 'Ana')
  const b = await addMember(ctx.db, group.id, 'Bo')
  const c = await addMember(ctx.db, group.id, 'Cy')
  return { groupId: group.id, memberIds: [a.id, b.id, c.id] }
}

describe('createExpense', () => {
  it('persists an expense with shares materialised by the EQUAL split', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()

    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })

    expect(expense.amountCents).toBe(100)
    expect(expense.splitMode).toBe('EQUAL')
    expect(expense.shares).toHaveLength(3)
    const total = expense.shares.reduce((sum, share) => sum + share.shareCents, 0)
    expect(total).toBe(100)
  })

  it('lets a payer who is not a participant pay the whole amount', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const [payer, ...participants] = memberIds

    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Gift',
      amountCents: 2000,
      paidByMemberId: payer as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds: participants },
    })

    expect(expense.shares.map((s) => s.memberId).sort()).toEqual([...participants].sort())
  })

  it('materialises an EXACT split exactly as given', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const [a, b] = memberIds as [string, string]

    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Groceries',
      amountCents: 1000,
      paidByMemberId: a,
      date: new Date('2026-09-01'),
      split: {
        mode: 'EXACT',
        shares: [
          { memberId: a, shareCents: 400 },
          { memberId: b, shareCents: 600 },
        ],
      },
    })

    expect(expense.shares.find((s) => s.memberId === a)?.shareCents).toBe(400)
    expect(expense.shares.find((s) => s.memberId === b)?.shareCents).toBe(600)
  })

  it('rejects an invalid split and writes nothing to the database', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()

    await expect(
      createExpense(ctx.db, {
        groupId,
        description: 'Bad split',
        amountCents: 1000,
        paidByMemberId: memberIds[0] as string,
        date: new Date('2026-09-01'),
        split: {
          mode: 'EXACT',
          shares: [
            { memberId: memberIds[0] as string, shareCents: 100 },
            { memberId: memberIds[1] as string, shareCents: 100 },
          ],
        },
      }),
    ).rejects.toThrow('Exact shares sum to 200, expected 1000')

    expect(await ctx.db.expense.count()).toBe(0)
  })

  it('reads back a persisted expense with the same shares it was created with', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()

    const created = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })

    const reloaded = await ctx.db.expense.findUniqueOrThrow({
      where: { id: created.id },
      include: { shares: true },
    })

    expect(reloaded.shares.map((s) => s.shareCents).sort()).toEqual(
      created.shares.map((s) => s.shareCents).sort(),
    )
  })
})

describe('deleteExpense', () => {
  it('deletes the expense and all of its shares', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })

    await deleteExpense(ctx.db, expense.id)

    expect(await ctx.db.expense.findUnique({ where: { id: expense.id } })).toBeNull()
    expect(await ctx.db.expenseShare.count({ where: { expenseId: expense.id } })).toBe(0)
  })

  it('rejects deleting the same expense twice', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })
    await deleteExpense(ctx.db, expense.id)

    await expect(deleteExpense(ctx.db, expense.id)).rejects.toThrow(ExpenseNotFoundError)
  })

  it('leaves a second, unrelated expense and its shares untouched', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const first = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })
    const second = await createExpense(ctx.db, {
      groupId,
      description: 'Groceries',
      amountCents: 200,
      paidByMemberId: memberIds[1] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })

    await deleteExpense(ctx.db, first.id)

    const remainingShares = await ctx.db.expenseShare.findMany({ where: { expenseId: second.id } })
    expect(remainingShares).toHaveLength(second.shares.length)
    expect(await ctx.db.expense.findUnique({ where: { id: second.id } })).not.toBeNull()
  })

  it('leaves the group and its members untouched', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const expense = await createExpense(ctx.db, {
      groupId,
      description: 'Dinner',
      amountCents: 100,
      paidByMemberId: memberIds[0] as string,
      date: new Date('2026-09-01'),
      split: { mode: 'EQUAL', memberIds },
    })

    await deleteExpense(ctx.db, expense.id)

    expect(await ctx.db.group.findUnique({ where: { id: groupId } })).not.toBeNull()
    expect(await ctx.db.member.count({ where: { groupId } })).toBe(memberIds.length)
  })
})

describe('createExpense group membership', () => {
  it('rejects a payer who belongs to a different group', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const otherGroup = await createGroup(ctx.db, { name: 'Other', currency: 'USD' })
    const outsider = await addMember(ctx.db, otherGroup.id, 'Intruder')

    await expect(
      createExpense(ctx.db, {
        groupId,
        description: 'Cross-group leak',
        amountCents: 1000,
        paidByMemberId: outsider.id,
        date: new Date('2026-09-01'),
        split: { mode: 'EQUAL', memberIds: [memberIds[0] as string] },
      }),
    ).rejects.toThrow(/does not belong to group|not a member/i)

    expect(await ctx.db.expense.count()).toBe(0)
  })

  it('rejects a split participant who belongs to a different group', async () => {
    const { groupId, memberIds } = await seedGroupOfThree()
    const otherGroup = await createGroup(ctx.db, { name: 'Other', currency: 'USD' })
    const outsider = await addMember(ctx.db, otherGroup.id, 'Intruder')

    await expect(
      createExpense(ctx.db, {
        groupId,
        description: 'Cross-group leak',
        amountCents: 1000,
        paidByMemberId: memberIds[0] as string,
        date: new Date('2026-09-01'),
        split: { mode: 'EQUAL', memberIds: [memberIds[0] as string, outsider.id] },
      }),
    ).rejects.toThrow(/does not belong to group|not a member/i)

    expect(await ctx.db.expense.count()).toBe(0)
  })
})

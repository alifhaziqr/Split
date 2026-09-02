import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createExpense } from '../../../src/server/db/expenses.js'
import { createGroup, GroupNotFoundError } from '../../../src/server/db/groups.js'
import { addMember, deleteMember, DuplicateMemberError, MemberNotFoundError, MemberReferencedError } from '../../../src/server/db/members.js'
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

describe('addMember', () => {
  it('adds a member to a group', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })

    const member = await addMember(ctx.db, group.id, 'Ana')

    expect(member.name).toBe('Ana')
    expect(member.groupId).toBe(group.id)
  })

  it('rejects a second member with the same name in the same group', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    await addMember(ctx.db, group.id, 'Ana')

    await expect(addMember(ctx.db, group.id, 'Ana')).rejects.toThrow(DuplicateMemberError)
  })

  it('allows the same name in two different groups', async () => {
    const groupA = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    const groupB = await createGroup(ctx.db, { name: 'Trip', currency: 'USD' })
    await addMember(ctx.db, groupA.id, 'Ana')

    await expect(addMember(ctx.db, groupB.id, 'Ana')).resolves.toBeDefined()
  })

  it('rejects a group that does not exist', async () => {
    await expect(addMember(ctx.db, 'nonexistent-group', 'Ana')).rejects.toThrow(GroupNotFoundError)
  })
})

describe('deleteMember', () => {
  it('deletes a member with no expenses', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    const member = await addMember(ctx.db, group.id, 'Ana')

    await deleteMember(ctx.db, member.id)

    expect(await ctx.db.member.findUnique({ where: { id: member.id } })).toBeNull()
  })

  it('rejects deleting a member who paid for an expense', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    const payer = await addMember(ctx.db, group.id, 'Ana')
    const other = await addMember(ctx.db, group.id, 'Bo')
    await createExpense(ctx.db, {
      groupId: group.id,
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: payer.id,
      date: new Date(),
      split: { mode: 'EQUAL', memberIds: [payer.id, other.id] },
    })

    await expect(deleteMember(ctx.db, payer.id)).rejects.toThrow(MemberReferencedError)
  })

  it('rejects deleting a member that does not exist', async () => {
    await expect(deleteMember(ctx.db, 'nonexistent-member')).rejects.toThrow(MemberNotFoundError)
  })

  it('rejects deleting a member who only owes a share, never paid', async () => {
    const group = await createGroup(ctx.db, { name: 'Roommates', currency: 'EUR' })
    const payer = await addMember(ctx.db, group.id, 'Ana')
    const other = await addMember(ctx.db, group.id, 'Bo')
    await createExpense(ctx.db, {
      groupId: group.id,
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: payer.id,
      date: new Date(),
      split: { mode: 'EQUAL', memberIds: [payer.id, other.id] },
    })

    await expect(deleteMember(ctx.db, other.id)).rejects.toThrow(MemberReferencedError)
  })
})

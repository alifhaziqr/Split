import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createGroup, getGroupWithDetails } from '../../../src/server/db/groups.js'
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

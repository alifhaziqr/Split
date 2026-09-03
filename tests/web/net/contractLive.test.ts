/**
 * The runtime half of the wire-type contract — tests/web/net/types.test.ts
 * proves the mirrored TYPES match at compile time; this proves the web API
 * client's actual runtime behavior matches the real server's actual
 * responses, by injecting the real Hono app's app.request as the client's
 * fetch implementation (the same seam createRequest/createApiClient give
 * tests everywhere else — see http.ts). Catches response-shape drift that a
 * mocked-fetch unit test cannot: if dto.ts ever changed shape without
 * types.ts's mirror following, this test would fail even though every
 * mocked-fetch test above stays green (they only assert against the
 * mirror's own assumed shape).
 *
 * Costs one real `prisma migrate deploy` subprocess in beforeAll, same as
 * the other tests/server/db and tests/server/api suites — see testDb.ts.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createApp } from '../../../src/server/app.js'
import { createApiClient } from '../../../src/web/net/client.js'
import type { FetchLike } from '../../../src/web/net/http.js'
import type { TestDatabase } from '../../server/db/testDb.js'
import { createTestDatabase, resetDb } from '../../server/db/testDb.js'

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

function clientAgainstRealApp() {
  // Hono's app.request(path, init) is structurally what this app ever
  // passes it (a string path plus a RequestInit) — not literally typed as
  // `typeof fetch`, so this narrows to the shape actually used. `async`
  // normalizes app.request's `Response | Promise<Response>` return (a
  // synchronous fast path) to the `Promise<Response>` FetchLike requires.
  const fetchViaApp: FetchLike = async (input, init) => app.request(input as string, init)
  return createApiClient({ fetch: fetchViaApp })
}

describe('web API client against the real server', () => {
  it('creates a group, adds members, records a mixed-mode expense, and reads a settlement that zeroes the balances', async () => {
    const client = clientAgainstRealApp()

    const group = await client.createGroup({ name: 'Trip', currency: 'USD' })
    expect(group.id).toBeTruthy()

    const ana = await client.addMember(group.id, { name: 'Ana' })
    const bob = await client.addMember(group.id, { name: 'Bob' })

    const expense = await client.createExpense(group.id, {
      description: 'Dinner',
      amountCents: 1000,
      paidByMemberId: ana.id,
      date: '2026-09-02',
      split: { mode: 'EQUAL', memberIds: [ana.id, bob.id] },
    })
    expect(expense.amountCents).toBe(1000)
    expect(expense.shares).toHaveLength(2)

    const details = await client.getGroup(group.id)
    expect(details.members).toHaveLength(2)
    expect(details.expenses).toHaveLength(1)

    const settlement = await client.getSettlement(group.id)
    expect(settlement.balances).toHaveLength(2)
    expect(settlement.transfers).toEqual([
      { fromMemberId: bob.id, toMemberId: ana.id, amountCents: 500 },
    ])

    await client.deleteExpense(expense.id)
    await client.deleteMember(group.id, ana.id)
    await client.deleteMember(group.id, bob.id)
    await client.deleteGroup(group.id)
    await expect(client.getGroup(group.id)).rejects.toMatchObject({
      status: 404,
      code: 'GROUP_NOT_FOUND',
    })
  })

  it('surfaces a real 409 as an ApiError with the real status, code, and message', async () => {
    const client = clientAgainstRealApp()
    const group = await client.createGroup({ name: 'Trip', currency: 'USD' })
    await client.addMember(group.id, { name: 'Ana' })

    await expect(client.addMember(group.id, { name: 'Ana' })).rejects.toMatchObject({
      status: 409,
      code: 'DUPLICATE_MEMBER',
    })
  })

  it('surfaces a real 422 for an unbalanced split as an ApiError', async () => {
    const client = clientAgainstRealApp()
    const group = await client.createGroup({ name: 'Trip', currency: 'USD' })
    const ana = await client.addMember(group.id, { name: 'Ana' })

    await expect(
      client.createExpense(group.id, {
        description: 'Dinner',
        amountCents: 1000,
        paidByMemberId: ana.id,
        date: '2026-09-02',
        split: { mode: 'EXACT', shares: [{ memberId: ana.id, shareCents: 500 }] },
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_SPLIT' })
  })
})

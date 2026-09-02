import { describe, expect, it } from 'vitest'

import { splitAmount } from '../../src/core/split.js'
import type { Transfer } from '../../src/core/settle.js'
import { settleGroup, toExpenseRecords } from '../../src/server/settlement.js'
import type { Balance } from '../../src/server/settlement.js'

// Plain-object stand-ins for GroupDetails and its nested Prisma rows. A unit
// test for a pure adapter has no business importing generated Prisma types —
// only the shape matters, so these are typed loosely and cast at the call site.

interface FakeMember {
  readonly id: string
  readonly groupId: string
  readonly name: string
}

interface FakeShare {
  readonly id: string
  readonly expenseId: string
  readonly memberId: string
  readonly shareCents: number
}

interface FakeExpense {
  readonly id: string
  readonly groupId: string
  readonly description: string
  readonly amountCents: number
  readonly paidByMemberId: string
  readonly date: Date
  readonly splitMode: 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES'
  readonly createdAt: Date
  readonly shares: FakeShare[]
}

interface FakeGroupDetails {
  readonly id: string
  readonly name: string
  readonly currency: string
  readonly createdAt: Date
  readonly members: FakeMember[]
  readonly expenses: FakeExpense[]
}

let expenseCounter = 0
let shareCounter = 0

/** Builds an EQUAL-split expense using the real splitAmount, so the numbers in
 * every fixture are genuinely correct rather than hand-typed and asserted. */
function equalExpense(
  groupId: string,
  paidByMemberId: string,
  amountCents: number,
  participantIds: readonly string[],
): FakeExpense {
  const shares = splitAmount(amountCents, { mode: 'EQUAL', memberIds: participantIds })
  expenseCounter += 1
  const expenseId = `expense-${expenseCounter}`
  return {
    id: expenseId,
    groupId,
    description: 'test expense',
    amountCents,
    paidByMemberId,
    date: new Date('2026-01-01'),
    splitMode: 'EQUAL',
    createdAt: new Date('2026-01-01'),
    shares: [...shares].map(([memberId, shareCents]) => {
      shareCounter += 1
      return { id: `share-${shareCounter}`, expenseId, memberId, shareCents }
    }),
  }
}

function member(groupId: string, id: string, name: string): FakeMember {
  return { id, groupId, name }
}

function applyTransfers(balances: readonly Balance[], transfers: readonly Transfer[]): Map<string, number> {
  const settled = new Map(balances.map((b) => [b.memberId, b.balanceCents]))
  for (const { fromMemberId, toMemberId, amountCents } of transfers) {
    settled.set(fromMemberId, (settled.get(fromMemberId) ?? 0) + amountCents)
    settled.set(toMemberId, (settled.get(toMemberId) ?? 0) - amountCents)
  }
  return settled
}

describe('toExpenseRecords', () => {
  it('builds a shares map from each expense shares array', () => {
    const expense = equalExpense('g1', 'a', 100, ['a', 'b', 'c'])
    const records = toExpenseRecords([expense])
    expect(records).toHaveLength(1)
    expect(records[0]?.paidByMemberId).toBe('a')
    expect(records[0]?.amountCents).toBe(100)
    expect(records[0]?.shares.get('a')).toBe(34)
    expect(records[0]?.shares.get('b')).toBe(33)
    expect(records[0]?.shares.get('c')).toBe(33)
  })
})

describe('settleGroup', () => {
  it('always produces balances summing to exactly zero cents', () => {
    const cases: FakeGroupDetails[] = [
      {
        id: 'g1',
        name: 'Trip',
        currency: 'USD',
        createdAt: new Date(),
        members: [member('g1', 'a', 'Ana'), member('g1', 'b', 'Bo'), member('g1', 'c', 'Cy')],
        expenses: [equalExpense('g1', 'a', 900, ['a', 'b', 'c']), equalExpense('g1', 'b', 300, ['a', 'b', 'c'])],
      },
      {
        id: 'g2',
        name: 'Solo',
        currency: 'USD',
        createdAt: new Date(),
        members: [member('g2', 'x', 'Xi')],
        expenses: [],
      },
      {
        id: 'g3',
        name: 'Big',
        currency: 'USD',
        createdAt: new Date(),
        members: [
          member('g3', 'a', 'Ana'),
          member('g3', 'b', 'Bo'),
          member('g3', 'c', 'Cy'),
          member('g3', 'd', 'Dee'),
        ],
        expenses: [
          equalExpense('g3', 'a', 1000, ['a', 'b']),
          equalExpense('g3', 'c', 250, ['a', 'b', 'c', 'd']),
          equalExpense('g3', 'd', 777, ['b', 'c', 'd']),
        ],
      },
    ]

    for (const details of cases) {
      const { balances } = settleGroup(details)
      const total = balances.reduce((sum, b) => sum + b.balanceCents, 0)
      expect(total).toBe(0)
    }
  })

  it('keeps a member with no expense activity at zero rather than dropping them', () => {
    const details: FakeGroupDetails = {
      id: 'g1',
      name: 'Trip',
      currency: 'USD',
      createdAt: new Date(),
      members: [member('g1', 'a', 'Ana'), member('g1', 'b', 'Bo'), member('g1', 'ghost', 'Ghost')],
      expenses: [equalExpense('g1', 'a', 500, ['a', 'b'])],
    }

    const { balances } = settleGroup(details)
    const ghost = balances.find((b) => b.memberId === 'ghost')
    expect(ghost).toEqual({ memberId: 'ghost', balanceCents: 0 })
  })

  it('produces transfers that zero every balance when applied', () => {
    const details: FakeGroupDetails = {
      id: 'g1',
      name: 'Trip',
      currency: 'USD',
      createdAt: new Date(),
      members: [
        member('g1', 'a', 'Ana'),
        member('g1', 'b', 'Bo'),
        member('g1', 'c', 'Cy'),
        member('g1', 'd', 'Dee'),
      ],
      expenses: [
        equalExpense('g1', 'a', 1000, ['a', 'b', 'c']),
        equalExpense('g1', 'd', 500, ['a', 'b', 'c', 'd']),
        equalExpense('g1', 'b', 733, ['a', 'b', 'c', 'd']),
      ],
    }

    const { balances, transfers } = settleGroup(details)
    const settled = applyTransfers(balances, transfers)
    for (const remaining of settled.values()) {
      expect(remaining).toBe(0)
    }
  })

  it('produces byte-identical output regardless of input array order', () => {
    const members = [member('g1', 'a', 'Ana'), member('g1', 'b', 'Bo'), member('g1', 'c', 'Cy')]
    const expenses = [
      equalExpense('g1', 'a', 900, ['a', 'b', 'c']),
      equalExpense('g1', 'b', 300, ['a', 'c']),
    ]

    const forward: FakeGroupDetails = {
      id: 'g1',
      name: 'Trip',
      currency: 'USD',
      createdAt: new Date(),
      members,
      expenses,
    }
    const reordered: FakeGroupDetails = {
      ...forward,
      members: [...members].reverse(),
      expenses: [...expenses].reverse().map((expense) => ({
        ...expense,
        shares: [...expense.shares].reverse(),
      })),
    }

    expect(JSON.stringify(settleGroup(forward))).toBe(JSON.stringify(settleGroup(reordered)))
  })

  it('returns every member at zero with no transfers when a group has no expenses', () => {
    const details: FakeGroupDetails = {
      id: 'g1',
      name: 'Empty',
      currency: 'USD',
      createdAt: new Date(),
      members: [member('g1', 'a', 'Ana'), member('g1', 'b', 'Bo')],
      expenses: [],
    }

    const { balances, transfers } = settleGroup(details)
    expect(balances).toEqual([
      { memberId: 'a', balanceCents: 0 },
      { memberId: 'b', balanceCents: 0 },
    ])
    expect(transfers).toEqual([])
  })

  it('splits a 100-cent equal expense three ways as 34/33/33 in the resulting balances', () => {
    const details: FakeGroupDetails = {
      id: 'g1',
      name: 'Coffee',
      currency: 'USD',
      createdAt: new Date(),
      members: [member('g1', 'a', 'Ana'), member('g1', 'b', 'Bo'), member('g1', 'c', 'Cy')],
      expenses: [equalExpense('g1', 'a', 100, ['a', 'b', 'c'])],
    }

    const { balances } = settleGroup(details)
    const byId = Object.fromEntries(balances.map((b) => [b.memberId, b.balanceCents]))
    // a paid 100, owes a 34-cent share of it -> net +66; b and c each owe their
    // 33-cent share and paid nothing -> net -33 each.
    expect(byId).toEqual({ a: 66, b: -33, c: -33 })
  })

  it('returns balances sorted by member id ascending', () => {
    const details: FakeGroupDetails = {
      id: 'g1',
      name: 'Trip',
      currency: 'USD',
      createdAt: new Date(),
      members: [member('g1', 'z', 'Zed'), member('g1', 'a', 'Ana'), member('g1', 'm', 'Mo')],
      expenses: [],
    }

    const { balances } = settleGroup(details)
    expect(balances.map((b) => b.memberId)).toEqual(['a', 'm', 'z'])
  })
})

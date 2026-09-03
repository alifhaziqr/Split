import { describe, expect, it } from 'vitest'

import {
  countReferencingExpenses,
  isMemberReferenced,
} from '../../../../src/web/features/members/memberUsage.js'
import type { WireExpense } from '../../../../src/web/net/types.js'

function expense(
  overrides: Partial<WireExpense> & Pick<WireExpense, 'paidByMemberId' | 'shares'>,
): WireExpense {
  return {
    id: 'e1',
    description: 'Dinner',
    amountCents: 1000,
    date: '2026-09-02T00:00:00.000Z',
    splitMode: 'EQUAL',
    createdAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  }
}

describe('isMemberReferenced', () => {
  it('is true when the member paid for an expense', () => {
    const expenses = [expense({ paidByMemberId: 'm1', shares: [] })]

    expect(isMemberReferenced('m1', expenses)).toBe(true)
  })

  it("is true when the member is on an expense's shares, even if they did not pay", () => {
    const expenses = [
      expense({ paidByMemberId: 'm2', shares: [{ memberId: 'm1', shareCents: 500 }] }),
    ]

    expect(isMemberReferenced('m1', expenses)).toBe(true)
  })

  it('is false when the member appears in no expense at all', () => {
    const expenses = [
      expense({ paidByMemberId: 'm2', shares: [{ memberId: 'm3', shareCents: 500 }] }),
    ]

    expect(isMemberReferenced('m1', expenses)).toBe(false)
  })

  it('is false for an empty expense list', () => {
    expect(isMemberReferenced('m1', [])).toBe(false)
  })
})

describe('countReferencingExpenses', () => {
  it('counts an expense once even if the member both paid and is in the shares', () => {
    const expenses = [
      expense({ paidByMemberId: 'm1', shares: [{ memberId: 'm1', shareCents: 500 }] }),
    ]

    expect(countReferencingExpenses('m1', expenses)).toBe(1)
  })

  it('counts across multiple expenses', () => {
    const expenses = [
      expense({ id: 'e1', paidByMemberId: 'm1', shares: [] }),
      expense({
        id: 'e2',
        paidByMemberId: 'm2',
        shares: [{ memberId: 'm1', shareCents: 500 }],
      }),
      expense({
        id: 'e3',
        paidByMemberId: 'm2',
        shares: [{ memberId: 'm3', shareCents: 500 }],
      }),
    ]

    expect(countReferencingExpenses('m1', expenses)).toBe(2)
  })

  it('agrees with isMemberReferenced: a nonzero count iff the member is referenced', () => {
    const referenced = [expense({ paidByMemberId: 'm1', shares: [] })]
    const unreferenced = [expense({ paidByMemberId: 'm2', shares: [] })]

    expect(countReferencingExpenses('m1', referenced) > 0).toBe(
      isMemberReferenced('m1', referenced),
    )
    expect(countReferencingExpenses('m1', unreferenced) > 0).toBe(
      isMemberReferenced('m1', unreferenced),
    )
  })
})

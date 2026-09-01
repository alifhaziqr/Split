import { describe, expect, it } from 'vitest'

import { splitAmount } from '../../src/core/split.js'
import { computeBalances, simplifyDebts } from '../../src/core/settle.js'
import type { ExpenseRecord, Transfer } from '../../src/core/settle.js'

const sum = (values: Iterable<number>): number => [...values].reduce((a, b) => a + b, 0)

/** Deterministic PRNG so an invariant failure is reproducible from the seed. */
function pseudoRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

function expense(
  paidByMemberId: string,
  amountCents: number,
  participants: readonly string[],
): ExpenseRecord {
  return {
    paidByMemberId,
    amountCents,
    shares: splitAmount(amountCents, { mode: 'EQUAL', memberIds: participants }),
  }
}

describe('computeBalances', () => {
  it('credits the payer and debits each participant', () => {
    const balances = computeBalances([expense('a', 900, ['a', 'b', 'c'])])
    expect(balances.get('a')).toBe(600)
    expect(balances.get('b')).toBe(-300)
    expect(balances.get('c')).toBe(-300)
  })

  it('credits a payer who is not a participant with the whole amount', () => {
    const balances = computeBalances([expense('a', 900, ['b', 'c'])])
    expect(balances.get('a')).toBe(900)
    expect(balances.get('b')).toBe(-450)
    expect(balances.get('c')).toBe(-450)
  })

  it('accumulates across several expenses', () => {
    const balances = computeBalances([
      expense('a', 900, ['a', 'b', 'c']),
      expense('b', 300, ['a', 'b', 'c']),
    ])
    expect(balances.get('a')).toBe(500)
    expect(balances.get('b')).toBe(-100)
    expect(balances.get('c')).toBe(-400)
  })

  it('leaves everyone at zero when a group is already square', () => {
    const balances = computeBalances([
      expense('a', 600, ['a', 'b']),
      expense('b', 600, ['a', 'b']),
    ])
    expect([...balances.values()]).toEqual([0, 0])
  })

  it('returns no balances for no expenses', () => {
    expect(computeBalances([]).size).toBe(0)
  })

  it('includes a member who only ever paid', () => {
    const balances = computeBalances([expense('a', 100, ['b'])])
    expect([...balances.keys()].sort()).toEqual(['a', 'b'])
  })

  it('rejects an expense whose shares do not sum to its amount', () => {
    const broken: ExpenseRecord = {
      paidByMemberId: 'a',
      amountCents: 1000,
      shares: new Map([
        ['a', 500],
        ['b', 499],
      ]),
    }
    expect(() => computeBalances([broken])).toThrow(/999.*1000|1000.*999/)
  })

  it('always produces balances that sum to zero', () => {
    const random = pseudoRandom(20260902)
    const members = ['ana', 'bo', 'cy', 'dee', 'eli']

    for (let run = 0; run < 300; run++) {
      const expenses = Array.from({ length: 1 + Math.floor(random() * 6) }, () => {
        const participants = members.filter(() => random() < 0.7)
        const roster = participants.length > 0 ? participants : [members[0] as string]
        const payer = members[Math.floor(random() * members.length)] as string
        return expense(payer, Math.floor(random() * 50_000), roster)
      })

      expect(sum(computeBalances(expenses).values())).toBe(0)
    }
  })
})

function applyTransfers(
  balances: ReadonlyMap<string, number>,
  transfers: readonly Transfer[],
): Map<string, number> {
  const settled = new Map(balances)
  for (const { fromMemberId, toMemberId, amountCents } of transfers) {
    settled.set(fromMemberId, (settled.get(fromMemberId) ?? 0) + amountCents)
    settled.set(toMemberId, (settled.get(toMemberId) ?? 0) - amountCents)
  }
  return settled
}

describe('simplifyDebts', () => {
  it('sends one payment from the debtor to the creditor', () => {
    const transfers = simplifyDebts(
      new Map([
        ['a', 500],
        ['b', -500],
      ]),
    )
    expect(transfers).toEqual([{ fromMemberId: 'b', toMemberId: 'a', amountCents: 500 }])
  })

  it('settles two debtors against one creditor in two payments', () => {
    const transfers = simplifyDebts(
      new Map([
        ['a', 500],
        ['b', -200],
        ['c', -300],
      ]),
    )
    expect(transfers).toHaveLength(2)
    expect(transfers).toContainEqual({ fromMemberId: 'c', toMemberId: 'a', amountCents: 300 })
    expect(transfers).toContainEqual({ fromMemberId: 'b', toMemberId: 'a', amountCents: 200 })
  })

  it('nets out a circular debt instead of walking the circle', () => {
    // a owes b, b owes c, c owes a — in net terms only one payment is needed.
    const transfers = simplifyDebts(
      new Map([
        ['a', -100],
        ['b', 0],
        ['c', 100],
      ]),
    )
    expect(transfers).toEqual([{ fromMemberId: 'a', toMemberId: 'c', amountCents: 100 }])
  })

  it('returns no payments when everyone is square', () => {
    expect(
      simplifyDebts(
        new Map([
          ['a', 0],
          ['b', 0],
        ]),
      ),
    ).toEqual([])
  })

  it('returns no payments for an empty group', () => {
    expect(simplifyDebts(new Map())).toEqual([])
  })

  it('leaves a settled member out of the payment list entirely', () => {
    const transfers = simplifyDebts(
      new Map([
        ['a', 300],
        ['settled', 0],
        ['b', -300],
      ]),
    )
    const involved = transfers.flatMap((t) => [t.fromMemberId, t.toMemberId])
    expect(involved).not.toContain('settled')
  })

  it('rejects balances that do not sum to zero', () => {
    expect(() =>
      simplifyDebts(
        new Map([
          ['a', 500],
          ['b', -400],
        ]),
      ),
    ).toThrow(/sum to zero|100/)
  })

  it('rejects a fractional balance', () => {
    expect(() =>
      simplifyDebts(
        new Map([
          ['a', 500.5],
          ['b', -500.5],
        ]),
      ),
    ).toThrow(/integer cents/)
  })

  it('breaks ties by member id so the payment list is reproducible', () => {
    const balances = new Map([
      ['b', -500],
      ['c', 500],
      ['a', 500],
      ['d', -500],
    ])
    expect(simplifyDebts(balances)).toEqual(simplifyDebts(new Map([...balances].reverse())))
  })

  it('settles every balance it is given, over many random groups', () => {
    const random = pseudoRandom(20260903)
    const members = ['ana', 'bo', 'cy', 'dee', 'eli', 'fen']

    for (let run = 0; run < 300; run++) {
      const expenses = Array.from({ length: 1 + Math.floor(random() * 8) }, () => {
        const participants = members.filter(() => random() < 0.6)
        const roster = participants.length > 0 ? participants : [members[0] as string]
        const payer = members[Math.floor(random() * members.length)] as string
        return expense(payer, Math.floor(random() * 100_000), roster)
      })
      const balances = computeBalances(expenses)

      const transfers = simplifyDebts(balances)

      const settled = applyTransfers(balances, transfers)
      for (const remaining of settled.values()) {
        expect(remaining).toBe(0)
      }

      const unsettled = [...balances.values()].filter((cents) => cents !== 0).length
      expect(transfers.length).toBeLessThanOrEqual(Math.max(unsettled - 1, 0))

      const payers = new Set(transfers.map((t) => t.fromMemberId))
      for (const transfer of transfers) {
        expect(payers.has(transfer.toMemberId)).toBe(false)
        expect(transfer.amountCents).toBeGreaterThan(0)
        expect(Number.isSafeInteger(transfer.amountCents)).toBe(true)
      }
    }
  })
})

describe('simplifyDebts payment quality', () => {
  // Worked by hand from the documented rule — largest creditor against largest
  // debtor, re-selected after every payment, ties by member id:
  //   f:23 vs c:17 -> c pays f 17   (f:6 left)
  //   d:12 vs e:14 -> e pays d 12   (e:2 left)
  //   f:6  vs a:6  -> a pays f 6    (both clear)
  //   b:2  vs e:2  -> e pays b 2
  it('re-matches a residual balance against the largest remaining party', () => {
    const transfers = simplifyDebts(
      new Map([
        ['a', -6],
        ['b', 2],
        ['c', -17],
        ['d', 12],
        ['e', -14],
        ['f', 23],
      ]),
    )
    expect(transfers).toEqual([
      { fromMemberId: 'c', toMemberId: 'f', amountCents: 17 },
      { fromMemberId: 'e', toMemberId: 'd', amountCents: 12 },
      { fromMemberId: 'a', toMemberId: 'f', amountCents: 6 },
      { fromMemberId: 'e', toMemberId: 'b', amountCents: 2 },
    ])
  })

  it('clears one party per payment, so a settled member is never paid twice over', () => {
    // Sorting once and walking would pay f twice here; re-selecting does not.
    const transfers = simplifyDebts(
      new Map([
        ['a', -6],
        ['b', 2],
        ['c', -17],
        ['d', 12],
        ['e', -14],
        ['f', 23],
      ]),
    )
    expect(transfers).toHaveLength(4)
  })
})

describe('computeBalances guards the persistence boundary', () => {
  // ExpenseRecord arrives from the database, not from splitAmount, so this is
  // where the integer-cents rule has to be enforced rather than assumed.
  it('rejects fractional shares even when they sum to the amount', () => {
    expect(() =>
      computeBalances([
        {
          paidByMemberId: 'a',
          amountCents: 1000,
          shares: new Map([
            ['a', 500.5],
            ['b', 499.5],
          ]),
        },
      ]),
    ).toThrow(/integer cents/)
  })

  it('rejects a fractional expense amount', () => {
    expect(() =>
      computeBalances([
        { paidByMemberId: 'a', amountCents: 10.5, shares: new Map([['b', 10.5]]) },
      ]),
    ).toThrow(/integer cents/)
  })

  it('rejects a negative expense amount', () => {
    expect(() =>
      computeBalances([
        { paidByMemberId: 'a', amountCents: -100, shares: new Map([['b', -100]]) },
      ]),
    ).toThrow(/negative/)
  })
})

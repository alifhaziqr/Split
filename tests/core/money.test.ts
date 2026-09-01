import { describe, expect, it } from 'vitest'

import { allocate, formatCents, parseAmountToCents } from '../../src/core/money.js'

describe('formatCents', () => {
  it('renders whole units with two decimal places', () => {
    expect(formatCents(8450)).toBe('84.50')
  })

  it('pads sub-unit amounts to two decimal places', () => {
    expect(formatCents(5)).toBe('0.05')
  })

  it('renders zero as 0.00', () => {
    expect(formatCents(0)).toBe('0.00')
  })

  it('keeps the sign in front of a negative amount', () => {
    expect(formatCents(-8450)).toBe('-84.50')
  })

  it('rejects a non-integer amount', () => {
    expect(() => formatCents(84.5)).toThrow(/integer cents/)
  })
})

describe('parseAmountToCents', () => {
  it('parses a two-decimal amount', () => {
    expect(parseAmountToCents('84.50')).toBe(8450)
  })

  it('parses a whole amount with no decimal point', () => {
    expect(parseAmountToCents('84')).toBe(8400)
  })

  it('treats a single decimal digit as tenths', () => {
    expect(parseAmountToCents('84.5')).toBe(8450)
  })

  it('parses a negative amount', () => {
    expect(parseAmountToCents('-0.05')).toBe(-5)
  })

  it('ignores surrounding whitespace', () => {
    expect(parseAmountToCents('  12.34  ')).toBe(1234)
  })

  it('rejects more precision than cents', () => {
    expect(() => parseAmountToCents('1.234')).toThrow(/1\.234/)
  })

  it('rejects a non-numeric string', () => {
    expect(() => parseAmountToCents('twelve')).toThrow(/twelve/)
  })

  it('rejects an empty string', () => {
    expect(() => parseAmountToCents('')).toThrow()
  })

  it('round-trips through formatCents', () => {
    expect(formatCents(parseAmountToCents('1234.05'))).toBe('1234.05')
  })
})

/** Deterministic PRNG so an invariant failure is reproducible from the seed. */
function pseudoRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const sum = (values: Iterable<number>): number => [...values].reduce((a, b) => a + b, 0)

describe('allocate', () => {
  it('splits an evenly divisible amount evenly', () => {
    const result = allocate(900, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
    ])
    expect([...result.values()]).toEqual([300, 300, 300])
  })

  it('gives leftover cents to the lowest member id when remainders tie', () => {
    const result = allocate(100, [
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
      { memberId: 'a', weight: 1 },
    ])
    expect(result.get('a')).toBe(34)
    expect(result.get('b')).toBe(33)
    expect(result.get('c')).toBe(33)
  })

  it('gives the leftover cent to the largest fractional remainder first', () => {
    // 10 cents over weights 1:2:2 -> 2.0 / 4.0 / 4.0 exactly; use 11 for a remainder.
    const result = allocate(11, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 2 },
      { memberId: 'c', weight: 2 },
    ])
    // exact shares 2.2 / 4.4 / 4.4 -> floors 2/4/4 = 10, one cent to the largest remainder
    expect(sum(result.values())).toBe(11)
    expect(result.get('b')).toBe(5)
    expect(result.get('a')).toBe(2)
    expect(result.get('c')).toBe(4)
  })

  it('allocates proportionally to unequal weights', () => {
    const result = allocate(1000, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 3 },
    ])
    expect(result.get('a')).toBe(250)
    expect(result.get('b')).toBe(750)
  })

  it('gives the whole amount to a single participant', () => {
    const result = allocate(8450, [{ memberId: 'only', weight: 1 }])
    expect(result.get('only')).toBe(8450)
  })

  it('allocates nothing when the total is zero', () => {
    const result = allocate(0, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 2 },
    ])
    expect([...result.values()]).toEqual([0, 0])
  })

  it('gives a zero-weight participant nothing', () => {
    const result = allocate(100, [
      { memberId: 'a', weight: 0 },
      { memberId: 'b', weight: 1 },
    ])
    expect(result.get('a')).toBe(0)
    expect(result.get('b')).toBe(100)
  })

  it('does not depend on the order participants are supplied in', () => {
    const forwards = allocate(1000, [
      { memberId: 'a', weight: 1 },
      { memberId: 'b', weight: 1 },
      { memberId: 'c', weight: 1 },
    ])
    const backwards = allocate(1000, [
      { memberId: 'c', weight: 1 },
      { memberId: 'b', weight: 1 },
      { memberId: 'a', weight: 1 },
    ])
    expect([...backwards].sort()).toEqual([...forwards].sort())
  })

  it('rejects an empty participant list', () => {
    expect(() => allocate(100, [])).toThrow(/at least one participant/)
  })

  it('rejects a duplicate member id', () => {
    expect(() =>
      allocate(100, [
        { memberId: 'a', weight: 1 },
        { memberId: 'a', weight: 1 },
      ]),
    ).toThrow(/duplicate/i)
  })

  it('rejects a negative weight', () => {
    expect(() =>
      allocate(100, [
        { memberId: 'a', weight: -1 },
        { memberId: 'b', weight: 2 },
      ]),
    ).toThrow(/weight/)
  })

  it('rejects weights that are all zero', () => {
    expect(() =>
      allocate(100, [
        { memberId: 'a', weight: 0 },
        { memberId: 'b', weight: 0 },
      ]),
    ).toThrow(/weight/)
  })

  it('rejects a negative total', () => {
    expect(() => allocate(-100, [{ memberId: 'a', weight: 1 }])).toThrow(/negative/)
  })

  it('rejects a fractional total', () => {
    expect(() => allocate(10.5, [{ memberId: 'a', weight: 1 }])).toThrow(/integer cents/)
  })

  it('always sums to exactly the total, over many random splits', () => {
    const random = pseudoRandom(20260901)
    for (let run = 0; run < 500; run++) {
      const total = Math.floor(random() * 1_000_00)
      const count = 1 + Math.floor(random() * 8)
      const participants = Array.from({ length: count }, (_, index) => ({
        memberId: `m${index}`,
        weight: 1 + Math.floor(random() * 10),
      }))

      const result = allocate(total, participants)

      expect(sum(result.values())).toBe(total)
      expect(result.size).toBe(count)
      for (const share of result.values()) {
        expect(Number.isSafeInteger(share)).toBe(true)
        expect(share).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('never spreads the remainder wider than one cent per participant', () => {
    const random = pseudoRandom(7)
    for (let run = 0; run < 200; run++) {
      const count = 2 + Math.floor(random() * 6)
      const total = Math.floor(random() * 10_000)
      const participants = Array.from({ length: count }, (_, index) => ({
        memberId: `m${index}`,
        weight: 1,
      }))

      const shares = [...allocate(total, participants).values()]

      expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(1)
    }
  })
})

import { describe, expect, it } from 'vitest'

import { splitAmount } from '../../src/core/split.js'
import type { SplitInput } from '../../src/core/split.js'

const sum = (values: Iterable<number>): number => [...values].reduce((a, b) => a + b, 0)

describe('splitAmount EQUAL', () => {
  it('divides evenly when the amount divides evenly', () => {
    const shares = splitAmount(8400, { mode: 'EQUAL', memberIds: ['a', 'b', 'c'] })
    expect([...shares.values()]).toEqual([2800, 2800, 2800])
  })

  it('splits 100 cents three ways as 34/33/33', () => {
    const shares = splitAmount(100, { mode: 'EQUAL', memberIds: ['a', 'b', 'c'] })
    expect(shares.get('a')).toBe(34)
    expect(shares.get('b')).toBe(33)
    expect(shares.get('c')).toBe(33)
  })

  it('gives the whole amount to a lone participant', () => {
    const shares = splitAmount(8450, { mode: 'EQUAL', memberIds: ['solo'] })
    expect(shares.get('solo')).toBe(8450)
  })

  it('rejects an expense with no participants', () => {
    expect(() => splitAmount(100, { mode: 'EQUAL', memberIds: [] })).toThrow(/participant/)
  })

  it('rejects a member listed twice', () => {
    expect(() => splitAmount(100, { mode: 'EQUAL', memberIds: ['a', 'a'] })).toThrow(/duplicate/i)
  })
})

describe('splitAmount EXACT', () => {
  it('uses the shares it is given', () => {
    const shares = splitAmount(1000, {
      mode: 'EXACT',
      shares: [
        { memberId: 'a', shareCents: 250 },
        { memberId: 'b', shareCents: 750 },
      ],
    })
    expect(shares.get('a')).toBe(250)
    expect(shares.get('b')).toBe(750)
  })

  it('allows a participant with a zero share', () => {
    const shares = splitAmount(1000, {
      mode: 'EXACT',
      shares: [
        { memberId: 'a', shareCents: 0 },
        { memberId: 'b', shareCents: 1000 },
      ],
    })
    expect(shares.get('a')).toBe(0)
  })

  it('rejects shares that do not sum to the amount', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'EXACT',
        shares: [
          { memberId: 'a', shareCents: 250 },
          { memberId: 'b', shareCents: 749 },
        ],
      }),
    ).toThrow(/999.*1000|1000.*999/)
  })

  it('rejects a negative share', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'EXACT',
        shares: [
          { memberId: 'a', shareCents: -100 },
          { memberId: 'b', shareCents: 1100 },
        ],
      }),
    ).toThrow(/negative/)
  })

  it('rejects a fractional share', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'EXACT',
        shares: [
          { memberId: 'a', shareCents: 250.5 },
          { memberId: 'b', shareCents: 749.5 },
        ],
      }),
    ).toThrow(/integer cents/)
  })
})

describe('splitAmount PERCENT', () => {
  it('splits by whole percentages', () => {
    const shares = splitAmount(10000, {
      mode: 'PERCENT',
      shares: [
        { memberId: 'a', percentBp: 2500 },
        { memberId: 'b', percentBp: 7500 },
      ],
    })
    expect(shares.get('a')).toBe(2500)
    expect(shares.get('b')).toBe(7500)
  })

  it('splits thirds that sum to 100 percent without losing a cent', () => {
    const shares = splitAmount(100, {
      mode: 'PERCENT',
      shares: [
        { memberId: 'a', percentBp: 3333 },
        { memberId: 'b', percentBp: 3333 },
        { memberId: 'c', percentBp: 3334 },
      ],
    })
    expect(sum(shares.values())).toBe(100)
  })

  it('rejects percentages that do not sum to 100', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'PERCENT',
        shares: [
          { memberId: 'a', percentBp: 5000 },
          { memberId: 'b', percentBp: 4000 },
        ],
      }),
    ).toThrow(/100/)
  })

  it('rejects a fractional basis point', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'PERCENT',
        shares: [
          { memberId: 'a', percentBp: 5000.5 },
          { memberId: 'b', percentBp: 4999.5 },
        ],
      }),
    ).toThrow(/basis point/)
  })

  it('rejects a negative percentage', () => {
    expect(() =>
      splitAmount(1000, {
        mode: 'PERCENT',
        shares: [
          { memberId: 'a', percentBp: -1000 },
          { memberId: 'b', percentBp: 11000 },
        ],
      }),
    ).toThrow(/negative|percent/)
  })
})

describe('splitAmount SHARES', () => {
  it('splits by relative weights', () => {
    const shares = splitAmount(10000, {
      mode: 'SHARES',
      shares: [
        { memberId: 'a', weight: 1 },
        { memberId: 'b', weight: 1 },
        { memberId: 'c', weight: 2 },
      ],
    })
    expect(shares.get('a')).toBe(2500)
    expect(shares.get('b')).toBe(2500)
    expect(shares.get('c')).toBe(5000)
  })

  it('distributes the remainder deterministically', () => {
    const shares = splitAmount(100, {
      mode: 'SHARES',
      shares: [
        { memberId: 'a', weight: 1 },
        { memberId: 'b', weight: 1 },
        { memberId: 'c', weight: 1 },
      ],
    })
    expect(sum(shares.values())).toBe(100)
    expect(shares.get('a')).toBe(34)
  })

  it('rejects weights that are all zero', () => {
    expect(() =>
      splitAmount(100, {
        mode: 'SHARES',
        shares: [
          { memberId: 'a', weight: 0 },
          { memberId: 'b', weight: 0 },
        ],
      }),
    ).toThrow(/weight/)
  })

  it('rejects a fractional weight', () => {
    expect(() =>
      splitAmount(100, {
        mode: 'SHARES',
        shares: [
          { memberId: 'a', weight: 1.5 },
          { memberId: 'b', weight: 1 },
        ],
      }),
    ).toThrow(/whole/)
  })
})

describe('splitAmount invariants', () => {
  const modes: readonly SplitInput[] = [
    { mode: 'EQUAL', memberIds: ['a', 'b', 'c'] },
    {
      mode: 'PERCENT',
      shares: [
        { memberId: 'a', percentBp: 1234 },
        { memberId: 'b', percentBp: 4321 },
        { memberId: 'c', percentBp: 4445 },
      ],
    },
    {
      mode: 'SHARES',
      shares: [
        { memberId: 'a', weight: 3 },
        { memberId: 'b', weight: 5 },
        { memberId: 'c', weight: 7 },
      ],
    },
  ]

  it('always produces shares summing to exactly the amount', () => {
    for (const input of modes) {
      for (let amountCents = 0; amountCents < 400; amountCents++) {
        const shares = splitAmount(amountCents, input)
        expect(sum(shares.values())).toBe(amountCents)
        expect(shares.size).toBe(3)
      }
    }
  })

  it('always produces integer cents', () => {
    for (const input of modes) {
      for (const share of splitAmount(99_999, input).values()) {
        expect(Number.isSafeInteger(share)).toBe(true)
      }
    }
  })

  it('splits nothing when the amount is zero', () => {
    const shares = splitAmount(0, { mode: 'EQUAL', memberIds: ['a', 'b'] })
    expect([...shares.values()]).toEqual([0, 0])
  })

  it('rejects a negative amount', () => {
    expect(() => splitAmount(-100, { mode: 'EQUAL', memberIds: ['a'] })).toThrow(/negative/)
  })

  it('rejects a fractional amount', () => {
    expect(() => splitAmount(10.5, { mode: 'EQUAL', memberIds: ['a'] })).toThrow(/integer cents/)
  })
})

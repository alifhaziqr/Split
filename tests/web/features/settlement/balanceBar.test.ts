import { describe, expect, it } from 'vitest'

import { balanceBarWidthPercent, balanceSign, maxAbsBalanceCents } from '../../../../src/web/features/settlement/balanceBar.js'

describe('balanceSign', () => {
  it('is positive for a positive balance', () => {
    expect(balanceSign(1250)).toBe('positive')
  })

  it('is negative for a negative balance', () => {
    expect(balanceSign(-1250)).toBe('negative')
  })

  it('is zero for an exactly zero balance', () => {
    expect(balanceSign(0)).toBe('zero')
  })
})

describe('balanceBarWidthPercent', () => {
  it('is 0 for a zero balance regardless of the group max', () => {
    expect(balanceBarWidthPercent(0, 10_000)).toBe(0)
  })

  it('is 100 for the largest-magnitude balance in the group', () => {
    expect(balanceBarWidthPercent(10_000, 10_000)).toBe(100)
    expect(balanceBarWidthPercent(-10_000, 10_000)).toBe(100)
  })

  it('is monotonic in the magnitude of cents', () => {
    const small = balanceBarWidthPercent(2_500, 10_000)
    const large = balanceBarWidthPercent(7_500, 10_000)
    expect(large).toBeGreaterThan(small)
  })

  it('never returns a value outside [0, 100]', () => {
    for (const cents of [0, 1, -1, 5_000, -5_000, 10_000, -10_000]) {
      const width = balanceBarWidthPercent(cents, 10_000)
      expect(width).toBeGreaterThanOrEqual(0)
      expect(width).toBeLessThanOrEqual(100)
    }
  })

  it('returns 0, never NaN, when everyone in the group is settled (max is 0)', () => {
    expect(balanceBarWidthPercent(0, 0)).toBe(0)
    // A non-zero balance can't coexist with a zero group max in practice
    // (the max is derived from the same balances), but the function must
    // not divide by zero into NaN if it's ever called that way anyway.
    expect(Number.isNaN(balanceBarWidthPercent(500, 0))).toBe(false)
  })
})

describe('maxAbsBalanceCents', () => {
  it('is 0 for an empty list', () => {
    expect(maxAbsBalanceCents([])).toBe(0)
  })

  it('is 0 when every balance is exactly zero', () => {
    expect(maxAbsBalanceCents([{ balanceCents: 0 }, { balanceCents: 0 }])).toBe(0)
  })

  it('picks the largest magnitude regardless of sign', () => {
    expect(maxAbsBalanceCents([{ balanceCents: 1_250 }, { balanceCents: -4_000 }, { balanceCents: 500 }])).toBe(4_000)
  })
})

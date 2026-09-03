import { describe, expect, it } from 'vitest'

import {
  AddMemberSchema,
  CreateExpenseSchema,
  CreateGroupSchema,
  SplitInputSchema,
} from '../../../src/server/api/schemas.js'

describe('SplitInputSchema', () => {
  it('parses a valid EQUAL split', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'EQUAL',
      memberIds: ['m1', 'm2', 'm3'],
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid EXACT split', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'EXACT',
      shares: [
        { memberId: 'm1', shareCents: 500 },
        { memberId: 'm2', shareCents: 500 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid PERCENT split', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'PERCENT',
      shares: [
        { memberId: 'm1', percentBp: 5000 },
        { memberId: 'm2', percentBp: 5000 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('parses a valid SHARES split', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'SHARES',
      shares: [
        { memberId: 'm1', weight: 1 },
        { memberId: 'm2', weight: 2 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an EQUAL payload that uses the shares field instead of memberIds', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'EQUAL',
      shares: [{ memberId: 'm1', shareCents: 500 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects a valid EQUAL payload with an extra unrecognized top-level field', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'EQUAL',
      memberIds: ['m1', 'm2'],
      note: 'not allowed',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a fractional amount in each arm needing whole numbers', () => {
    const exact = SplitInputSchema.safeParse({
      mode: 'EXACT',
      shares: [{ memberId: 'm1', shareCents: 5.5 }],
    })
    const percent = SplitInputSchema.safeParse({
      mode: 'PERCENT',
      shares: [{ memberId: 'm1', percentBp: 10000.5 }],
    })
    const shares = SplitInputSchema.safeParse({
      mode: 'SHARES',
      shares: [{ memberId: 'm1', weight: 1.5 }],
    })
    expect(exact.success).toBe(false)
    expect(percent.success).toBe(false)
    expect(shares.success).toBe(false)
  })

  it('rejects a negative amount in each arm', () => {
    const exact = SplitInputSchema.safeParse({
      mode: 'EXACT',
      shares: [{ memberId: 'm1', shareCents: -1 }],
    })
    const percent = SplitInputSchema.safeParse({
      mode: 'PERCENT',
      shares: [{ memberId: 'm1', percentBp: -1 }],
    })
    const shares = SplitInputSchema.safeParse({
      mode: 'SHARES',
      shares: [{ memberId: 'm1', weight: -1 }],
    })
    expect(exact.success).toBe(false)
    expect(percent.success).toBe(false)
    expect(shares.success).toBe(false)
  })

  it('rejects an amountCents that exceeds the 32-bit signed int max', () => {
    const result = CreateExpenseSchema.safeParse({
      description: 'too big',
      amountCents: 2147483648,
      paidByMemberId: 'm1',
      date: '2024-01-01',
      split: { mode: 'EQUAL', memberIds: ['m1'] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an empty memberIds array', () => {
    const result = SplitInputSchema.safeParse({ mode: 'EQUAL', memberIds: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an empty shares array', () => {
    const result = SplitInputSchema.safeParse({ mode: 'EXACT', shares: [] })
    expect(result.success).toBe(false)
  })

  it('lets an unbalanced PERCENT split parse — core rejects the arithmetic, not zod', () => {
    const result = SplitInputSchema.safeParse({
      mode: 'PERCENT',
      shares: [{ memberId: 'm1', percentBp: 9999 }],
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateGroupSchema', () => {
  it('parses a valid group', () => {
    const result = CreateGroupSchema.safeParse({ name: 'Trip', currency: 'USD' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = CreateGroupSchema.safeParse({ name: '', currency: 'USD' })
    expect(result.success).toBe(false)
  })

  it('rejects an unrecognized top-level field', () => {
    const result = CreateGroupSchema.safeParse({
      name: 'Trip',
      currency: 'USD',
      extra: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('AddMemberSchema', () => {
  it('parses a valid member', () => {
    const result = AddMemberSchema.safeParse({ name: 'Alice' })
    expect(result.success).toBe(true)
  })

  it('rejects an empty name', () => {
    const result = AddMemberSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})

describe('CreateExpenseSchema', () => {
  const base = {
    description: 'Dinner',
    amountCents: 1000,
    paidByMemberId: 'm1',
    split: { mode: 'EQUAL' as const, memberIds: ['m1', 'm2'] },
  }

  it('parses a valid ISO date string into a real Date instance', () => {
    const result = CreateExpenseSchema.safeParse({ ...base, date: '2024-06-15' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.date).toBeInstanceOf(Date)
    }
  })

  it('rejects a non-date string for the date field', () => {
    const result = CreateExpenseSchema.safeParse({ ...base, date: 'not a date' })
    expect(result.success).toBe(false)
  })
})

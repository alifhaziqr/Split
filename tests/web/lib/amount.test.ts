import { describe, expect, it } from 'vitest'

import { parseAmount } from '../../../src/web/lib/amount.js'

describe('parseAmount', () => {
  it('parses a two-decimal amount to cents', () => {
    expect(parseAmount('84.50')).toEqual({ ok: true, cents: 8450 })
  })

  it('parses a whole-dollar amount to cents', () => {
    expect(parseAmount('12')).toEqual({ ok: true, cents: 1200 })
  })

  it('parses a one-decimal amount to cents', () => {
    expect(parseAmount('12.5')).toEqual({ ok: true, cents: 1250 })
  })

  it("rejects an empty string with web-owned copy, not core's developer message", () => {
    const result = parseAmount('')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Enter an amount like 12.50')
      // Never echo core's ValidationError message, which JSON-stringifies
      // the user's own input back at them.
      expect(result.message).not.toContain('""')
    }
  })

  it('rejects non-numeric text', () => {
    expect(parseAmount('abc')).toEqual({
      ok: false,
      message: 'Enter an amount like 12.50',
    })
  })

  it('rejects more than two decimal places', () => {
    expect(parseAmount('1.234')).toEqual({
      ok: false,
      message: 'Enter an amount like 12.50',
    })
  })

  it('rejects a negative amount, even though core allows negative cents arithmetic', () => {
    // The API's AmountCents schema is min(0) — an expense can't have a
    // negative amount, even though parseAmountToCents itself would parse one.
    expect(parseAmount('-5')).toEqual({
      ok: false,
      message: 'Enter an amount like 12.50',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(parseAmount('  9.99  ')).toEqual({ ok: true, cents: 999 })
  })

  it('never throws for any string input', () => {
    for (const input of ['', ' ', '.', '-', '1e5', '84.500', 'NaN', '--5', '1.2.3']) {
      expect(() => parseAmount(input)).not.toThrow()
    }
  })
})

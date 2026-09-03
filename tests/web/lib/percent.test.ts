import { describe, expect, it } from 'vitest'

import { formatBp, parsePercentToBp } from '../../../src/web/lib/percent.js'

describe('parsePercentToBp', () => {
  it('parses "33.33" to 3333 basis points — the human types percent, never bp', () => {
    expect(parsePercentToBp('33.33')).toEqual({ ok: true, bp: 3333 })
  })

  it('parses "100" to 10000', () => {
    expect(parsePercentToBp('100')).toEqual({ ok: true, bp: 10000 })
  })

  it('rejects invalid text with web-owned copy', () => {
    expect(parsePercentToBp('abc')).toEqual({
      ok: false,
      message: 'Enter a percentage like 33.33',
    })
  })

  it('rejects a negative percentage', () => {
    expect(parsePercentToBp('-5')).toEqual({
      ok: false,
      message: 'Enter a percentage like 33.33',
    })
  })

  it('never throws for any string input', () => {
    for (const input of ['', ' ', '.', '-', '1e5', '33.333']) {
      expect(() => parsePercentToBp(input)).not.toThrow()
    }
  })
})

describe('formatBp', () => {
  it('formats 3333 basis points as "33.33"', () => {
    expect(formatBp(3333)).toBe('33.33')
  })

  it('formats 10000 basis points as "100.00"', () => {
    expect(formatBp(10000)).toBe('100.00')
  })

  it('round-trips parse -> format for a range of percentages', () => {
    for (const text of ['0.01', '12.50', '33.33', '66.67', '100.00']) {
      const parsed = parsePercentToBp(text)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(formatBp(parsed.bp)).toBe(text)
      }
    }
  })
})

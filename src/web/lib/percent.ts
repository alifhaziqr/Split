/**
 * Text <-> basis points, for the PERCENT split mode. The human types
 * "33.33", never "3333" — basis points are a storage representation, not a
 * UI. That makes percent-with-two-decimals the identical parsing problem as
 * dollars-with-two-decimals, so this delegates to core/money.ts exactly
 * like lib/amount.ts does, rather than duplicating a second decimal parser.
 */

import { formatCents, parseAmountToCents } from '../../core/money.js'

export type ParsedPercent = { readonly ok: true; readonly bp: number } | { readonly ok: false; readonly message: string }

const INVALID_PERCENT_MESSAGE = 'Enter a percentage like 33.33'

export function parsePercentToBp(text: string): ParsedPercent {
  let bp: number
  try {
    bp = parseAmountToCents(text)
  } catch {
    return { ok: false, message: INVALID_PERCENT_MESSAGE }
  }

  // A percentage can't be negative, even though parseAmountToCents (built
  // for money, which can be negative in balance arithmetic) would parse one.
  if (bp < 0) {
    return { ok: false, message: INVALID_PERCENT_MESSAGE }
  }

  return { ok: true, bp }
}

export function formatBp(bp: number): string {
  return formatCents(bp)
}

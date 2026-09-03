/**
 * Text <-> cents, the one place a human's typed dollar amount is converted.
 * Delegates to core/money.ts's parseAmountToCents rather than re-implementing
 * its two-decimal parsing rule — see CLAUDE.md's src/web architecture note:
 * web may import core/money.ts and core/split.ts for input parsing and
 * display formatting, never core/settle.ts.
 *
 * core throws ValidationError; a UI wants a value. This wrapper catches
 * `unknown` (not `instanceof ValidationError` — see CLAUDE.md's M3 note on
 * `instanceof` against an import silently resolving to `undefined`) and
 * substitutes web-owned, user-facing copy. Core owns the rule; web owns the
 * words — core's own message JSON-stringifies the user's raw input back at
 * them, which is a developer sentence, not something to show a user.
 */

import { parseAmountToCents } from '../../core/money.js'

export type ParsedAmount =
  | { readonly ok: true; readonly cents: number }
  | { readonly ok: false; readonly message: string }

const INVALID_AMOUNT_MESSAGE = 'Enter an amount like 12.50'

export function parseAmount(text: string): ParsedAmount {
  let cents: number
  try {
    cents = parseAmountToCents(text)
  } catch {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  // core allows negative cents (it's used for balance arithmetic too), but
  // the API's AmountCents schema is min(0) — an expense amount can't be
  // negative — so that boundary belongs here, at the one place text becomes
  // an amount a form will submit.
  if (cents < 0) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  return { ok: true, cents }
}

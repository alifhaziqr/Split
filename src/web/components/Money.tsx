/**
 * The only place cents become display text, currency code included.
 * formatCents(cents) + ' ' + currency ('84.50 USD') rather than
 * Intl.NumberFormat — Intl requires a `number`, which would reintroduce
 * cents / 100 (a float) into the display path. This keeps every digit on
 * screen coming from the same integer-cents string formatCents produces.
 */

import { formatCents } from '../../core/money.js'

export function Money(props: { readonly cents: number; readonly currency: string }) {
  return (
    <span>
      {formatCents(props.cents)} {props.currency}
    </span>
  )
}

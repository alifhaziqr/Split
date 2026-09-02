/**
 * The "remaining to assign" readout. aria-live so a screen reader announces
 * it as the user types, without moving focus — same requirement as the
 * accessibility attribute doubling as the RTL query everywhere else in
 * this app.
 */

import { formatCents } from '../../../core/money.js'
import { formatBp } from '../../lib/percent.js'
import type { SplitStatus } from './splitDraft.js'

function summaryText(status: SplitStatus): string {
  switch (status.kind) {
    case 'ok':
      return 'Everything is assigned.'
    case 'no-participants':
      return 'Select at least one participant.'
    case 'no-amount':
      return 'Enter an amount first.'
    case 'exact-unbalanced':
      return status.remainingCents > 0
        ? `${formatCents(status.remainingCents)} left to assign.`
        : `Over by ${formatCents(-status.remainingCents)}.`
    case 'percent-unbalanced':
      return status.remainingBp > 0
        ? `${formatBp(status.remainingBp)}% remaining.`
        : `Over by ${formatBp(-status.remainingBp)}%.`
    case 'shares-zero-weight':
      return 'At least one participant needs a nonzero share.'
  }
}

export function SplitSummary(props: { readonly status: SplitStatus }) {
  return <p aria-live="polite">{summaryText(props.status)}</p>
}

import { useState } from 'react'

import { ConfirmButton } from '../../components/ConfirmButton.js'
import { Money } from '../../components/Money.js'
import { displayDate } from '../../lib/displayDate.js'
import type { WireExpense, WireMember } from '../../net/types.js'

export function ExpenseRow(props: {
  readonly expense: WireExpense
  readonly members: readonly WireMember[]
  readonly currency: string
  readonly onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { expense, members } = props

  function nameFor(memberId: string): string {
    return members.find((m) => m.id === memberId)?.name ?? memberId
  }

  return (
    <li className="space-y-2 rounded-lg border border-subtle bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div>
          <span className="font-medium text-fg">{expense.description}</span>{' '}
          <span className="text-sm text-muted">
            — paid by {nameFor(expense.paidByMemberId)} on {displayDate(expense.date)}
          </span>
        </div>
        <Money cents={expense.amountCents} currency={props.currency} />
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide details' : 'Details'}
        </button>
        <ConfirmButton onConfirm={props.onDelete}>Delete</ConfirmButton>
      </div>
      {expanded && (
        <ul className="space-y-1 border-t border-subtle pt-2 text-sm text-muted">
          {expense.shares.map((share) => (
            <li key={share.memberId} className="flex justify-between">
              <span>{nameFor(share.memberId)}</span>
              <Money cents={share.shareCents} currency={props.currency} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

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
    <li>
      <span>{expense.description}</span> — paid by {nameFor(expense.paidByMemberId)} on {displayDate(expense.date)} —{' '}
      <Money cents={expense.amountCents} currency={props.currency} />
      <button type="button" onClick={() => setExpanded((prev) => !prev)}>
        {expanded ? 'Hide details' : 'Details'}
      </button>
      <ConfirmButton onConfirm={props.onDelete}>Delete</ConfirmButton>
      {expanded && (
        <ul>
          {expense.shares.map((share) => (
            <li key={share.memberId}>
              {nameFor(share.memberId)}: <Money cents={share.shareCents} currency={props.currency} />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

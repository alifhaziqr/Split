/**
 * The largest form in the app. See splitDraft.ts for the split-mode state
 * machine and CLAUDE.md's M5 note for why the client both pre-validates the
 * sum rules (an affordance — "3.50 left to assign") and still shows a 422
 * if one ever slips through (a client bug worth surfacing, not swallowing).
 */

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router'

import { formatCents } from '../../../core/money.js'
import { splitAmount } from '../../../core/split.js'
import { ErrorBanner } from '../../components/ErrorBanner.js'
import { parseAmount } from '../../lib/amount.js'
import { useCreateExpense } from '../../queries/expenses.js'
import type { WireMember } from '../../net/types.js'
import { SplitEditor } from './SplitEditor.js'
import { SplitModeTabs } from './SplitModeTabs.js'
import { SplitSummary } from './SplitSummary.js'
import { createInitialDraft, splitStatus, toWireSplitInput } from './splitDraft.js'
import type { SplitDraft } from './splitDraft.js'

export function AddExpenseForm(props: { readonly groupId: string; readonly members: readonly WireMember[] }) {
  const navigate = useNavigate()
  const createExpense = useCreateExpense(props.groupId)

  const [description, setDescription] = useState('')
  const [amountText, setAmountText] = useState('')
  const [paidByMemberId, setPaidByMemberId] = useState('')
  const [date, setDate] = useState('')
  const [draft, setDraft] = useState<SplitDraft>(() => createInitialDraft(props.members.map((m) => m.id)))

  const parsedAmount = parseAmount(amountText)
  const amountCents = parsedAmount.ok ? parsedAmount.cents : null
  const status = splitStatus(draft, amountCents)
  const canSubmit =
    status.kind === 'ok' && description.trim() !== '' && paidByMemberId !== '' && date !== '' && !createExpense.isPending

  let preview: ReadonlyMap<string, number> | null = null
  if (status.kind === 'ok' && amountCents !== null) {
    try {
      preview = splitAmount(amountCents, status.input)
    } catch {
      // A momentarily inconsistent draft (e.g. mid-edit) — no preview, not a crash.
      preview = null
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.kind !== 'ok' || amountCents === null) {
      return
    }
    createExpense.mutate(
      { description, amountCents, paidByMemberId, date, split: toWireSplitInput(status.input) },
      {
        onSuccess: () => {
          void navigate(`/groups/${props.groupId}`)
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="expense-description">Description</label>
        <input id="expense-description" value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="expense-amount">Amount</label>
        <input
          id="expense-amount"
          inputMode="decimal"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="expense-paid-by">Paid by</label>
        <select id="expense-paid-by" value={paidByMemberId} onChange={(e) => setPaidByMemberId(e.target.value)} required>
          <option value="">Select a payer</option>
          {props.members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="expense-date">Date</label>
        <input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      <SplitModeTabs mode={draft.mode} onChange={(mode) => setDraft({ ...draft, mode })} />
      <SplitEditor members={props.members} draft={draft} onChange={setDraft} />
      <SplitSummary status={status} />

      {preview !== null && (
        <ul>
          {[...preview.entries()].map(([memberId, cents]) => {
            const member = props.members.find((m) => m.id === memberId)
            return (
              <li key={memberId}>
                {/* formatCents, not (cents / 100).toFixed(2) — this is a
                    money display, and CLAUDE.md's rule against floats for
                    money applies to every display, not only arithmetic that
                    feeds back into storage. */}
                {member?.name ?? memberId}: {formatCents(cents)}
              </li>
            )
          })}
        </ul>
      )}

      <button type="submit" disabled={!canSubmit}>
        {createExpense.isPending ? 'Adding…' : 'Add expense'}
      </button>
      <ErrorBanner error={createExpense.error} />
    </form>
  )
}

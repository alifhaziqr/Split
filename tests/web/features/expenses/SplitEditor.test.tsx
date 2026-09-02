import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { SplitEditor } from '../../../../src/web/features/expenses/SplitEditor.js'
import { SplitModeTabs } from '../../../../src/web/features/expenses/SplitModeTabs.js'
import { SplitSummary } from '../../../../src/web/features/expenses/SplitSummary.js'
import { createInitialDraft, setMode, splitStatus } from '../../../../src/web/features/expenses/splitDraft.js'
import type { SplitDraft } from '../../../../src/web/features/expenses/splitDraft.js'
import type { WireMember } from '../../../../src/web/net/types.js'

/**
 * A field whose displayed value is driven directly by the draft prop (the
 * SHARES stepper) needs onChange actually fed back into a re-render to be
 * typed into at all — a bare vi.fn() spy leaves the DOM value pinned to the
 * initial draft, and userEvent.type then types into that fixed value
 * instead of an updating one. This wrapper matches how AddExpenseForm will
 * really use SplitEditor: draft lives in state, onChange updates it.
 */
function StatefulSplitEditor(props: { readonly members: readonly WireMember[]; readonly initialDraft: SplitDraft; readonly onChange: (draft: SplitDraft) => void }) {
  const [draft, setDraft] = useState(props.initialDraft)
  return (
    <SplitEditor
      members={props.members}
      draft={draft}
      onChange={(next) => {
        setDraft(next)
        props.onChange(next)
      }}
    />
  )
}

const MEMBERS: WireMember[] = [
  { id: 'm1', name: 'Ana' },
  { id: 'm2', name: 'Bob' },
]

describe('SplitModeTabs', () => {
  it('renders the four modes as a radiogroup and calls onChange when one is picked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<SplitModeTabs mode="EQUAL" onChange={onChange} />)

    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'EXACT' }))

    expect(onChange).toHaveBeenCalledWith('EXACT')
  })
})

describe('SplitSummary', () => {
  it('shows how much is left to assign for an unbalanced EXACT split', () => {
    render(<SplitSummary status={{ kind: 'exact-unbalanced', remainingCents: 350 }} />)

    expect(screen.getByText(/3\.50 left to assign/i)).toBeInTheDocument()
  })

  it('shows an over-by message when shares exceed the amount', () => {
    render(<SplitSummary status={{ kind: 'exact-unbalanced', remainingCents: -120 }} />)

    expect(screen.getByText(/over by 1\.20/i)).toBeInTheDocument()
  })

  it('shows percent remaining for an unbalanced PERCENT split', () => {
    render(<SplitSummary status={{ kind: 'percent-unbalanced', remainingBp: 1250 }} />)

    expect(screen.getByText(/12\.50% remaining/i)).toBeInTheDocument()
  })

  it('confirms everything is assigned for an ok status', () => {
    render(<SplitSummary status={{ kind: 'ok', input: { mode: 'EQUAL', memberIds: ['m1'] } }} />)

    expect(screen.getByText(/everything is assigned/i)).toBeInTheDocument()
  })
})

describe('SplitEditor', () => {
  it('toggling a participant checkbox calls onChange with the updated selection', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = createInitialDraft(['m1', 'm2'])
    render(<SplitEditor members={MEMBERS} draft={draft} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Bob' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ participantIds: ['m1'] }))
  })

  it('typing a valid EXACT amount updates the draft with parsed cents', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = setMode(createInitialDraft(['m1', 'm2']), 'EXACT')
    render(<SplitEditor members={MEMBERS} draft={draft} onChange={onChange} />)

    await user.type(screen.getByLabelText('Ana amount'), '3.50')

    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(splitStatus(lastCall, 1000)).toMatchObject({ remainingCents: expect.any(Number) })
    expect(lastCall.exactCentsById.get('m1')).toBe(350)
  })

  it('typing "33.33" in PERCENT sets 3333 basis points — the human types percent, never bp', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = setMode(createInitialDraft(['m1', 'm2']), 'PERCENT')
    render(<SplitEditor members={MEMBERS} draft={draft} onChange={onChange} />)

    await user.type(screen.getByLabelText('Ana percent'), '33.33')

    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall.percentBpById.get('m1')).toBe(3333)
  })

  it('changing the SHARES weight stepper updates the draft', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = setMode(createInitialDraft(['m1', 'm2']), 'SHARES')
    render(<StatefulSplitEditor members={MEMBERS} initialDraft={draft} onChange={onChange} />)

    const input = screen.getByLabelText('Ana weight')
    await user.clear(input)
    await user.type(input, '3')

    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall.weightById.get('m1')).toBe(3)
  })

  it('does not propagate an unparseable EXACT amount to the draft', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = setMode(createInitialDraft(['m1', 'm2']), 'EXACT')
    render(<SplitEditor members={MEMBERS} draft={draft} onChange={onChange} />)

    await user.type(screen.getByLabelText('Ana amount'), 'abc')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not leak EXACT text into the PERCENT field after switching modes', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const exactDraft = setMode(createInitialDraft(['m1', 'm2']), 'EXACT')
    const { rerender } = render(<SplitEditor members={MEMBERS} draft={exactDraft} onChange={onChange} />)

    await user.type(screen.getByLabelText('Ana amount'), '50.00')

    // Same component instance (rerender, not a fresh render) — this is what
    // AddExpenseForm actually does when SplitModeTabs changes draft.mode.
    const percentDraft = setMode(exactDraft, 'PERCENT')
    rerender(<SplitEditor members={MEMBERS} draft={percentDraft} onChange={onChange} />)

    // "50.00" must NOT appear as if 50% had been entered — the field is a
    // different mode's input and nothing has been typed into it yet.
    expect(screen.getByLabelText('Ana percent')).toHaveValue('')
  })

  it('rejects a non-integer or negative SHARES weight rather than committing it to the draft', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    const draft = setMode(createInitialDraft(['m1', 'm2']), 'SHARES')
    render(<StatefulSplitEditor members={MEMBERS} initialDraft={draft} onChange={onChange} />)

    const input = screen.getByLabelText('Ana weight')
    await user.clear(input)
    await user.type(input, '2.5')

    for (const call of onChange.mock.calls) {
      const committed = call[0] as SplitDraft
      expect(committed.weightById.get('m1')).not.toBe(2.5)
    }
  })
})

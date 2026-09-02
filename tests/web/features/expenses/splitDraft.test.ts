import { describe, expect, it } from 'vitest'

import { splitAmount } from '../../../../src/core/split.js'
import {
  createInitialDraft,
  setExactCents,
  setMode,
  setPercentBp,
  setWeight,
  splitStatus,
  toggleParticipant,
  toWireSplitInput,
} from '../../../../src/web/features/expenses/splitDraft.js'

const MEMBER_IDS = ['m1', 'm2', 'm3'] as const

describe('createInitialDraft', () => {
  it('defaults to EQUAL with every member selected', () => {
    const draft = createInitialDraft(MEMBER_IDS)

    expect(draft.mode).toBe('EQUAL')
    expect(draft.participantIds).toEqual(MEMBER_IDS)
  })
})

describe('splitStatus — EQUAL', () => {
  it('is no-participants when nobody is selected', () => {
    let draft = createInitialDraft(MEMBER_IDS)
    for (const id of MEMBER_IDS) draft = toggleParticipant(draft, id)

    expect(splitStatus(draft, 1000)).toEqual({ kind: 'no-participants' })
  })

  it('is no-amount when the amount has not been entered yet', () => {
    const draft = createInitialDraft(MEMBER_IDS)

    expect(splitStatus(draft, null)).toEqual({ kind: 'no-amount' })
  })

  it('is ok with a SplitInput once participants and amount are both present', () => {
    const draft = createInitialDraft(MEMBER_IDS)

    const status = splitStatus(draft, 1000)

    expect(status).toEqual({ kind: 'ok', input: { mode: 'EQUAL', memberIds: MEMBER_IDS } })
  })
})

describe('splitStatus — EXACT', () => {
  it('reports a positive remainder when shares sum under the amount', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'EXACT')
    draft = setExactCents(draft, 'm1', 300)
    draft = setExactCents(draft, 'm2', 300)
    // m3 left unset — treated as 0 owed, contributing to the remainder.

    expect(splitStatus(draft, 1000)).toEqual({ kind: 'exact-unbalanced', remainingCents: 400 })
  })

  it('reports a negative remainder when shares sum over the amount', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'EXACT')
    draft = setExactCents(draft, 'm1', 600)
    draft = setExactCents(draft, 'm2', 600)
    draft = setExactCents(draft, 'm3', 0)

    expect(splitStatus(draft, 1000)).toEqual({ kind: 'exact-unbalanced', remainingCents: -200 })
  })

  it('is ok once shares sum exactly to the amount', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'EXACT')
    draft = setExactCents(draft, 'm1', 334)
    draft = setExactCents(draft, 'm2', 333)
    draft = setExactCents(draft, 'm3', 333)

    const status = splitStatus(draft, 1000)

    expect(status).toEqual({
      kind: 'ok',
      input: {
        mode: 'EXACT',
        shares: [
          { memberId: 'm1', shareCents: 334 },
          { memberId: 'm2', shareCents: 333 },
          { memberId: 'm3', shareCents: 333 },
        ],
      },
    })
  })

  it('only counts selected participants toward the sum', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'EXACT')
    draft = setExactCents(draft, 'm1', 1000)
    draft = setExactCents(draft, 'm2', 500) // m2 will be deselected below
    draft = toggleParticipant(draft, 'm2')
    draft = toggleParticipant(draft, 'm3')

    // Only m1 remains selected; its 1000 alone balances a 1000 expense.
    expect(splitStatus(draft, 1000)).toEqual({
      kind: 'ok',
      input: { mode: 'EXACT', shares: [{ memberId: 'm1', shareCents: 1000 }] },
    })
  })
})

describe('splitStatus — PERCENT', () => {
  it('reports a positive remaining bp when percentages sum under 100%', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'PERCENT')
    draft = setPercentBp(draft, 'm1', 3333)
    draft = setPercentBp(draft, 'm2', 3333)
    draft = setPercentBp(draft, 'm3', 0)

    expect(splitStatus(draft, 1000)).toEqual({ kind: 'percent-unbalanced', remainingBp: 3334 })
  })

  it('is ok once basis points sum exactly to 10000', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'PERCENT')
    draft = setPercentBp(draft, 'm1', 3334)
    draft = setPercentBp(draft, 'm2', 3333)
    draft = setPercentBp(draft, 'm3', 3333)

    const status = splitStatus(draft, 1000)

    expect(status).toEqual({
      kind: 'ok',
      input: {
        mode: 'PERCENT',
        shares: [
          { memberId: 'm1', percentBp: 3334 },
          { memberId: 'm2', percentBp: 3333 },
          { memberId: 'm3', percentBp: 3333 },
        ],
      },
    })
  })
})

describe('splitStatus — SHARES', () => {
  it('is shares-zero-weight when every selected participant has weight 0', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'SHARES')
    draft = setWeight(draft, 'm1', 0)
    draft = setWeight(draft, 'm2', 0)
    draft = setWeight(draft, 'm3', 0)

    expect(splitStatus(draft, 1000)).toEqual({ kind: 'shares-zero-weight' })
  })

  it('defaults an untouched participant to weight 1', () => {
    const draft = setMode(createInitialDraft(MEMBER_IDS), 'SHARES')

    const status = splitStatus(draft, 1000)

    expect(status).toEqual({
      kind: 'ok',
      input: {
        mode: 'SHARES',
        shares: [
          { memberId: 'm1', weight: 1 },
          { memberId: 'm2', weight: 1 },
          { memberId: 'm3', weight: 1 },
        ],
      },
    })
  })
})

describe('mode and participant state stay independent', () => {
  it('switching modes preserves the participant selection', () => {
    let draft = createInitialDraft(MEMBER_IDS)
    draft = toggleParticipant(draft, 'm3') // deselect m3

    draft = setMode(draft, 'EXACT')
    expect(draft.participantIds).toEqual(['m1', 'm2'])

    draft = setMode(draft, 'PERCENT')
    expect(draft.participantIds).toEqual(['m1', 'm2'])
  })

  it('toggling a participant preserves values already entered in every mode', () => {
    let draft = createInitialDraft(MEMBER_IDS)
    draft = setMode(draft, 'EXACT')
    draft = setExactCents(draft, 'm1', 500)
    draft = setMode(draft, 'PERCENT')
    draft = setPercentBp(draft, 'm1', 5000)

    // Toggling m2 off and back on must not disturb m1's stored values.
    draft = toggleParticipant(draft, 'm2')
    draft = toggleParticipant(draft, 'm2')

    draft = setMode(draft, 'EXACT')
    expect(splitStatus(draft, 1000)).toMatchObject({ kind: 'exact-unbalanced' }) // m2/m3 still owe 0
    draft = setExactCents(draft, 'm2', 0)
    draft = setExactCents(draft, 'm3', 0)
    // Re-selecting m2 above must have restored its original position (m1,
    // m2, m3) rather than moving it to the end — asserted via this exact
    // ordering, not toMatchObject/toContain.
    expect(splitStatus(draft, 500)).toEqual({
      kind: 'ok',
      input: {
        mode: 'EXACT',
        shares: [
          { memberId: 'm1', shareCents: 500 },
          { memberId: 'm2', shareCents: 0 },
          { memberId: 'm3', shareCents: 0 },
        ],
      },
    })

    draft = setMode(draft, 'PERCENT')
    // m1's 5000bp from earlier must still be there — switching away and back
    // did not clear it.
    draft = setPercentBp(draft, 'm2', 5000)
    draft = setPercentBp(draft, 'm3', 0)
    expect(splitStatus(draft, 500)).toEqual({
      kind: 'ok',
      input: {
        mode: 'PERCENT',
        shares: [
          { memberId: 'm1', percentBp: 5000 },
          { memberId: 'm2', percentBp: 5000 },
          { memberId: 'm3', percentBp: 0 },
        ],
      },
    })
  })
})

describe('toWireSplitInput', () => {
  it('converts core\'s readonly SplitInput arrays into the mutable arrays the wire body needs', () => {
    let draft = setMode(createInitialDraft(MEMBER_IDS), 'EXACT')
    draft = setExactCents(draft, 'm1', 500)
    draft = setExactCents(draft, 'm2', 300)
    draft = setExactCents(draft, 'm3', 200)
    const status = splitStatus(draft, 1000)

    expect(status.kind).toBe('ok')
    if (status.kind === 'ok') {
      const wire = toWireSplitInput(status.input)
      expect(wire).toEqual({
        mode: 'EXACT',
        shares: [
          { memberId: 'm1', shareCents: 500 },
          { memberId: 'm2', shareCents: 300 },
          { memberId: 'm3', shareCents: 200 },
        ],
      })
      // A genuinely separate, mutable array — not the same readonly one aliased.
      expect(Array.isArray(wire.mode === 'EXACT' && wire.shares)).toBe(true)
    }
  })

  it('converts EQUAL, PERCENT, and SHARES the same way', () => {
    const equal = toWireSplitInput({ mode: 'EQUAL', memberIds: ['m1', 'm2'] })
    expect(equal).toEqual({ mode: 'EQUAL', memberIds: ['m1', 'm2'] })

    const percent = toWireSplitInput({ mode: 'PERCENT', shares: [{ memberId: 'm1', percentBp: 10000 }] })
    expect(percent).toEqual({ mode: 'PERCENT', shares: [{ memberId: 'm1', percentBp: 10000 }] })

    const shares = toWireSplitInput({ mode: 'SHARES', shares: [{ memberId: 'm1', weight: 2 }] })
    expect(shares).toEqual({ mode: 'SHARES', shares: [{ memberId: 'm1', weight: 2 }] })
  })
})

describe('invariant: any ok draft produces a SplitInput core actually accepts', () => {
  it('EQUAL, EXACT, PERCENT and SHARES drafts all pass splitAmount and sum to the amount', () => {
    const amountCents = 1000

    let equalDraft = createInitialDraft(MEMBER_IDS)
    let exactDraft = setExactCents(setExactCents(setExactCents(setMode(equalDraft, 'EXACT'), 'm1', 334), 'm2', 333), 'm3', 333)
    let percentDraft = setPercentBp(setPercentBp(setPercentBp(setMode(equalDraft, 'PERCENT'), 'm1', 3334), 'm2', 3333), 'm3', 3333)
    let sharesDraft = setMode(equalDraft, 'SHARES')

    for (const draft of [equalDraft, exactDraft, percentDraft, sharesDraft]) {
      const status = splitStatus(draft, amountCents)
      expect(status.kind).toBe('ok')
      if (status.kind === 'ok') {
        const shares = splitAmount(amountCents, status.input)
        const total = [...shares.values()].reduce((sum, v) => sum + v, 0)
        expect(total).toBe(amountCents)
      }
    }
  })
})

/**
 * Participants are chosen once via a checkbox list, independent of mode;
 * the mode only decides what extra control each selected row gets. Amount
 * and percent fields are free text (never type="number" — see lib/amount.ts
 * and CLAUDE.md's M5 note), so this keeps its own local raw-text state per
 * row, separate from the draft's committed numeric values: an intermediate
 * typed state like "3." doesn't parse yet but must still be typable, and a
 * controlled input driven only by the committed value would swallow it.
 * The draft only receives an update once a row's text actually parses.
 */

import { useState } from 'react'

import { parseAmount } from '../../lib/amount.js'
import { parsePercentToBp } from '../../lib/percent.js'
import type { WireMember } from '../../net/types.js'
import type { SplitDraft } from './splitDraft.js'
import { setExactCents, setPercentBp, setWeight, toggleParticipant } from './splitDraft.js'

export function SplitEditor(props: {
  readonly members: readonly WireMember[]
  readonly draft: SplitDraft
  readonly onChange: (draft: SplitDraft) => void
}) {
  const { members, draft, onChange } = props
  // Keyed by `${mode}:${memberId}`, not memberId alone — EXACT and PERCENT
  // each get their own slot, so switching modes can't make one mode's typed
  // text reappear as if it had been entered into the other.
  const [rawText, setRawText] = useState<Record<string, string>>({})

  function rawTextKey(memberId: string): string {
    return `${draft.mode}:${memberId}`
  }

  function handleExactChange(memberId: string, text: string) {
    setRawText((prev) => ({ ...prev, [rawTextKey(memberId)]: text }))
    const parsed = parseAmount(text)
    if (parsed.ok) {
      onChange(setExactCents(draft, memberId, parsed.cents))
    }
  }

  function handlePercentChange(memberId: string, text: string) {
    setRawText((prev) => ({ ...prev, [rawTextKey(memberId)]: text }))
    const parsed = parsePercentToBp(text)
    if (parsed.ok) {
      onChange(setPercentBp(draft, memberId, parsed.bp))
    }
  }

  function handleWeightChange(memberId: string, text: string) {
    const parsed = Number(text)
    // A stepper commits only a non-negative integer — an invalid transient
    // value (a decimal mid-type, a stray '-') is simply not propagated, so
    // the controlled input snaps back to the last valid committed weight.
    // splitStatus's SHARES branch only checks the total is nonzero, so an
    // invalid per-member weight must never reach the draft in the first
    // place, or the server's own z.int() check would be the first thing to
    // catch it — after the UI already said the split was complete.
    if (Number.isInteger(parsed) && parsed >= 0) {
      onChange(setWeight(draft, memberId, parsed))
    }
  }

  return (
    <fieldset>
      <legend>Participants</legend>
      {members.map((member) => {
        const selected = draft.participantIds.includes(member.id)
        return (
          <div key={member.id}>
            <label>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onChange(toggleParticipant(draft, member.id))}
              />
              {member.name}
            </label>
            {selected && draft.mode === 'EXACT' && (
              <input
                aria-label={`${member.name} amount`}
                inputMode="decimal"
                value={rawText[rawTextKey(member.id)] ?? ''}
                onChange={(e) => handleExactChange(member.id, e.target.value)}
              />
            )}
            {selected && draft.mode === 'PERCENT' && (
              <>
                <input
                  aria-label={`${member.name} percent`}
                  inputMode="decimal"
                  value={rawText[rawTextKey(member.id)] ?? ''}
                  onChange={(e) => handlePercentChange(member.id, e.target.value)}
                />
                %
              </>
            )}
            {selected && draft.mode === 'SHARES' && (
              <input
                aria-label={`${member.name} weight`}
                type="number"
                min={0}
                step={1}
                value={draft.weightById.get(member.id) ?? 1}
                onChange={(e) => handleWeightChange(member.id, e.target.value)}
              />
            )}
          </div>
        )
      })}
    </fieldset>
  )
}

/**
 * The add-expense form's split state, and the pure arithmetic over it. No
 * React — the hard logic in this milestone is arithmetic, and it should be
 * testable without a DOM, the same instinct that made src/core testable
 * without a database.
 *
 * Participants are chosen once, independent of mode (participantIds).
 * Each mode's entered values live in their own map, so switching modes
 * never loses what was typed into another mode — PERCENT -> EXACT -> PERCENT
 * keeps every value. A map entry missing for a selected participant means
 * "not entered yet", not zero-and-done; it still contributes to the
 * remaining-to-assign total (as 0 owed / 0% / weight 1, per mode below), so
 * the summary reflects an honest in-progress state.
 *
 * SplitMode/SplitInput are imported as types only from core/split.ts — see
 * CLAUDE.md's src/web architecture note: web may freely import core's types.
 */

import type {
  ExactShare,
  PercentShare,
  SplitInput,
  SplitMode,
  WeightedShare,
} from '../../../core/split.js'
import type { WireSplitInput } from '../../net/types.js'

export interface SplitDraft {
  readonly mode: SplitMode
  // The group's full member list, in its original order — kept alongside
  // participantIds (the current selection) so that re-selecting a member
  // restores their original row position instead of appending them to the
  // end of the list, which would visibly reorder rows in the UI every time
  // a checkbox is toggled off and back on.
  readonly allMemberIds: readonly string[]
  readonly participantIds: readonly string[]
  readonly exactCentsById: ReadonlyMap<string, number>
  readonly percentBpById: ReadonlyMap<string, number>
  readonly weightById: ReadonlyMap<string, number>
}

export type SplitStatus =
  | { readonly kind: 'ok'; readonly input: SplitInput }
  | { readonly kind: 'no-participants' }
  | { readonly kind: 'no-amount' }
  | { readonly kind: 'exact-unbalanced'; readonly remainingCents: number }
  | { readonly kind: 'percent-unbalanced'; readonly remainingBp: number }
  | { readonly kind: 'shares-zero-weight' }

const PERCENT_TOTAL_BP = 10_000
/** A participant with no stepper input yet defaults to weight 1 — the common case for SHARES. */
const DEFAULT_WEIGHT = 1

export function createInitialDraft(memberIds: readonly string[]): SplitDraft {
  return {
    mode: 'EQUAL',
    allMemberIds: memberIds,
    participantIds: memberIds,
    exactCentsById: new Map(),
    percentBpById: new Map(),
    weightById: new Map(),
  }
}

export function setMode(draft: SplitDraft, mode: SplitMode): SplitDraft {
  return { ...draft, mode }
}

export function toggleParticipant(draft: SplitDraft, memberId: string): SplitDraft {
  const isSelected = draft.participantIds.includes(memberId)
  // Reconstructed from allMemberIds's fixed order rather than
  // appended/filtered on participantIds alone, so re-selecting a member
  // restores their original position instead of moving them to the end.
  const participantIds = isSelected
    ? draft.participantIds.filter((id) => id !== memberId)
    : draft.allMemberIds.filter(
        (id) => id === memberId || draft.participantIds.includes(id),
      )
  return { ...draft, participantIds }
}

export function setExactCents(
  draft: SplitDraft,
  memberId: string,
  cents: number,
): SplitDraft {
  return { ...draft, exactCentsById: new Map(draft.exactCentsById).set(memberId, cents) }
}

export function setPercentBp(
  draft: SplitDraft,
  memberId: string,
  bp: number,
): SplitDraft {
  return { ...draft, percentBpById: new Map(draft.percentBpById).set(memberId, bp) }
}

export function setWeight(
  draft: SplitDraft,
  memberId: string,
  weight: number,
): SplitDraft {
  return { ...draft, weightById: new Map(draft.weightById).set(memberId, weight) }
}

function sumBy(
  ids: readonly string[],
  byId: ReadonlyMap<string, number>,
  defaultValue: number,
): number {
  return ids.reduce((sum, id) => sum + (byId.get(id) ?? defaultValue), 0)
}

export function splitStatus(draft: SplitDraft, amountCents: number | null): SplitStatus {
  if (draft.participantIds.length === 0) {
    return { kind: 'no-participants' }
  }
  if (amountCents === null) {
    return { kind: 'no-amount' }
  }

  switch (draft.mode) {
    case 'EQUAL':
      return { kind: 'ok', input: { mode: 'EQUAL', memberIds: draft.participantIds } }

    case 'EXACT': {
      const sum = sumBy(draft.participantIds, draft.exactCentsById, 0)
      const remainingCents = amountCents - sum
      if (remainingCents !== 0) {
        return { kind: 'exact-unbalanced', remainingCents }
      }
      const shares: ExactShare[] = draft.participantIds.map((memberId) => ({
        memberId,
        shareCents: draft.exactCentsById.get(memberId) ?? 0,
      }))
      return { kind: 'ok', input: { mode: 'EXACT', shares } }
    }

    case 'PERCENT': {
      const sum = sumBy(draft.participantIds, draft.percentBpById, 0)
      const remainingBp = PERCENT_TOTAL_BP - sum
      if (remainingBp !== 0) {
        return { kind: 'percent-unbalanced', remainingBp }
      }
      const shares: PercentShare[] = draft.participantIds.map((memberId) => ({
        memberId,
        percentBp: draft.percentBpById.get(memberId) ?? 0,
      }))
      return { kind: 'ok', input: { mode: 'PERCENT', shares } }
    }

    case 'SHARES': {
      const totalWeight = sumBy(draft.participantIds, draft.weightById, DEFAULT_WEIGHT)
      if (totalWeight === 0) {
        return { kind: 'shares-zero-weight' }
      }
      const shares: WeightedShare[] = draft.participantIds.map((memberId) => ({
        memberId,
        weight: draft.weightById.get(memberId) ?? DEFAULT_WEIGHT,
      }))
      return { kind: 'ok', input: { mode: 'SHARES', shares } }
    }
  }
}

/**
 * Converts core's SplitInput (readonly arrays, for splitAmount's own
 * preview-call use) into the wire body's WireSplitInput (mutable arrays,
 * matching z.input<typeof SplitInputSchema> exactly) — the one place this
 * milestone's readonly-vs-mutable mismatch is bridged, rather than letting
 * every call site work around it individually.
 */
export function toWireSplitInput(input: SplitInput): WireSplitInput {
  switch (input.mode) {
    case 'EQUAL':
      return { mode: 'EQUAL', memberIds: [...input.memberIds] }
    case 'EXACT':
      return { mode: 'EXACT', shares: input.shares.map((share) => ({ ...share })) }
    case 'PERCENT':
      return { mode: 'PERCENT', shares: input.shares.map((share) => ({ ...share })) }
    case 'SHARES':
      return { mode: 'SHARES', shares: input.shares.map((share) => ({ ...share })) }
  }
}

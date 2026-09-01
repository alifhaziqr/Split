/**
 * Divides an expense across its participants, one function per split mode.
 *
 * Every mode returns shares that sum to `amountCents` exactly — see CLAUDE.md.
 * EQUAL, PERCENT and SHARES are all weighted allocations under the skin, so
 * they delegate to `allocate` and inherit its largest-remainder determinism.
 * EXACT is the odd one out: the caller supplies the cents, so we only check them.
 */

import { allocate } from './money.js'
import type { AllocationWeight } from './money.js'

export type SplitMode = 'EQUAL' | 'EXACT' | 'PERCENT' | 'SHARES'

export interface ExactShare {
  readonly memberId: string
  readonly shareCents: number
}

/** Percentages are integer basis points — 33.33% is 3333 — so they never float. */
export interface PercentShare {
  readonly memberId: string
  readonly percentBp: number
}

export interface WeightedShare {
  readonly memberId: string
  readonly weight: number
}

export type SplitInput =
  | { readonly mode: 'EQUAL'; readonly memberIds: readonly string[] }
  | { readonly mode: 'EXACT'; readonly shares: readonly ExactShare[] }
  | { readonly mode: 'PERCENT'; readonly shares: readonly PercentShare[] }
  | { readonly mode: 'SHARES'; readonly shares: readonly WeightedShare[] }

const PERCENT_TOTAL_BP = 10_000

export function splitAmount(amountCents: number, input: SplitInput): Map<string, number> {
  switch (input.mode) {
    case 'EQUAL':
      return splitEqually(amountCents, input.memberIds)
    case 'EXACT':
      return splitExactly(amountCents, input.shares)
    case 'PERCENT':
      return splitByPercent(amountCents, input.shares)
    case 'SHARES':
      return splitByWeight(amountCents, input.shares)
  }
}

function splitEqually(amountCents: number, memberIds: readonly string[]): Map<string, number> {
  const weights: AllocationWeight[] = memberIds.map((memberId) => ({ memberId, weight: 1 }))
  return allocate(amountCents, weights)
}

function splitExactly(amountCents: number, shares: readonly ExactShare[]): Map<string, number> {
  if (shares.length === 0) {
    throw new Error('An expense needs at least one participant')
  }

  const result = new Map<string, number>()
  let total = 0
  for (const { memberId, shareCents } of shares) {
    if (result.has(memberId)) {
      throw new Error(`Duplicate participant in split: ${memberId}`)
    }
    if (!Number.isSafeInteger(shareCents)) {
      throw new Error(`Share must be integer cents, got ${shareCents} for ${memberId}`)
    }
    if (shareCents < 0) {
      throw new Error(`Share must not be negative: ${shareCents} for ${memberId}`)
    }
    result.set(memberId, shareCents)
    total += shareCents
  }

  if (total !== amountCents) {
    throw new Error(`Exact shares sum to ${total}, expected ${amountCents}`)
  }
  return result
}

function splitByPercent(amountCents: number, shares: readonly PercentShare[]): Map<string, number> {
  let totalBp = 0
  const weights: AllocationWeight[] = shares.map(({ memberId, percentBp }) => {
    if (!Number.isSafeInteger(percentBp)) {
      throw new Error(`Percentage must be whole basis points, got ${percentBp} for ${memberId}`)
    }
    if (percentBp < 0) {
      throw new Error(`Percentage must not be negative: ${percentBp} for ${memberId}`)
    }
    totalBp += percentBp
    return { memberId, weight: percentBp }
  })

  if (shares.length > 0 && totalBp !== PERCENT_TOTAL_BP) {
    throw new Error(
      `Percentages must sum to 100% (${PERCENT_TOTAL_BP} basis points), got ${totalBp}`,
    )
  }
  return allocate(amountCents, weights)
}

function splitByWeight(amountCents: number, shares: readonly WeightedShare[]): Map<string, number> {
  const weights: AllocationWeight[] = shares.map(({ memberId, weight }) => {
    if (!Number.isSafeInteger(weight)) {
      throw new Error(`Split weight must be a whole number, got ${weight} for ${memberId}`)
    }
    return { memberId, weight }
  })
  return allocate(amountCents, weights)
}

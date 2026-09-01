/**
 * Money is always integer cents. Never floats, never dollars.
 * See CLAUDE.md — every function here refuses a non-integer input rather than
 * silently rounding it, because a rounded cent is a bug that hides for months.
 */

function assertIntegerCents(cents: number, label: string): void {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`${label} must be integer cents, got ${cents}`)
  }
}

/** Renders cents for display: 8450 -> "84.50". Never used for arithmetic. */
export function formatCents(cents: number): string {
  assertIntegerCents(cents, 'amount')

  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const units = Math.trunc(absolute / 100)
  const remainder = absolute % 100

  return `${sign}${units}.${String(remainder).padStart(2, '0')}`
}

/** Accepts at most two decimal places, because a third would not be a cent. */
const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/

/** Parses user input into cents: "84.5" -> 8450. The only entry point for text. */
export function parseAmountToCents(input: string): number {
  const trimmed = input.trim()
  if (!AMOUNT_PATTERN.test(trimmed)) {
    throw new Error(`Not a valid amount: ${JSON.stringify(input)}`)
  }

  const negative = trimmed.startsWith('-')
  const [units = '0', fraction = ''] = trimmed.replace('-', '').split('.')
  const cents = Number(units) * 100 + Number(fraction.padEnd(2, '0'))

  assertIntegerCents(cents, 'amount')
  // `negative && cents === 0` would give -0, which is not Object.is-equal to 0.
  return negative && cents !== 0 ? -cents : cents
}

/** One participant's claim on an amount. Weight units are arbitrary and relative. */
export interface AllocationWeight {
  readonly memberId: string
  readonly weight: number
}

/**
 * Divides `totalCents` across weighted participants so the shares sum to the
 * total *exactly* — the invariant the whole app rests on.
 *
 * Largest-remainder method: everyone gets their floored exact share, then the
 * leftover cents go one each to the largest fractional remainders. Ties are
 * broken by member id so the same input always produces the same output, which
 * is what makes a stored split reproducible months later.
 */
export function allocate(
  totalCents: number,
  weights: readonly AllocationWeight[],
): Map<string, number> {
  assertIntegerCents(totalCents, 'total')
  if (totalCents < 0) {
    throw new Error(`Cannot allocate a negative total: ${totalCents}`)
  }
  if (weights.length === 0) {
    throw new Error('Allocation needs at least one participant')
  }

  const seen = new Set<string>()
  let totalWeight = 0
  for (const { memberId, weight } of weights) {
    if (seen.has(memberId)) {
      throw new Error(`Duplicate participant in allocation: ${memberId}`)
    }
    seen.add(memberId)

    // Integer weights keep `totalCents * weight` an exact integer numerator,
    // which is what the largest-remainder proof below depends on.
    if (!Number.isSafeInteger(weight)) {
      throw new Error(`Allocation weight must be a whole number, got ${weight} for ${memberId}`)
    }
    if (weight < 0) {
      throw new Error(`Allocation weight must be zero or positive, got ${weight} for ${memberId}`)
    }
    totalWeight += weight
  }
  if (totalWeight <= 0) {
    throw new Error('Allocation weights must not sum to zero')
  }

  // Exact share = totalCents * weight / totalWeight, kept as an integer
  // numerator so no float ever touches a cent boundary.
  const floors = weights.map(({ memberId, weight }) => {
    const numerator = totalCents * weight
    return {
      memberId,
      share: Math.floor(numerator / totalWeight),
      remainder: numerator % totalWeight,
    }
  })

  const distributed = floors.reduce((running, entry) => running + entry.share, 0)

  // Leftover is strictly less than the participant count, so one extra cent
  // each to the largest remainders always lands exactly on the total.
  const byRemainder = [...floors].sort(
    (a, b) => b.remainder - a.remainder || (a.memberId < b.memberId ? -1 : 1),
  )
  for (let index = 0; index < totalCents - distributed; index++) {
    const entry = byRemainder[index]
    if (entry === undefined) {
      throw new Error('unreachable: leftover cents exceeded the participant count')
    }
    entry.share += 1
  }

  return new Map(floors.map(({ memberId, share }) => [memberId, share]))
}

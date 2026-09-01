/**
 * Turns a group's expenses into net balances, and net balances into the
 * shortest practical list of payments that squares everyone up.
 *
 * Two invariants carry the whole module:
 *   - balances always sum to zero (money is only ever moved, never created)
 *   - applying every transfer leaves all balances at zero
 * A violation of either means a bug upstream, so both are checked, not assumed.
 */

/** An expense with its shares already materialised — see CLAUDE.md on write-time splits. */
export interface ExpenseRecord {
  readonly paidByMemberId: string
  readonly amountCents: number
  readonly shares: ReadonlyMap<string, number>
}

/**
 * Net position per member: positive is owed to them, negative is owed by them.
 * Members appear if they paid for anything or owe a share of anything.
 */
export function computeBalances(expenses: readonly ExpenseRecord[]): Map<string, number> {
  const balances = new Map<string, number>()
  const add = (memberId: string, cents: number): void => {
    balances.set(memberId, (balances.get(memberId) ?? 0) + cents)
  }

  for (const { paidByMemberId, amountCents, shares } of expenses) {
    // An ExpenseRecord comes from storage, not from splitAmount, so the
    // integer-cents rule is enforced here rather than assumed upstream.
    if (!Number.isSafeInteger(amountCents)) {
      throw new Error(`Expense amount must be integer cents, got ${amountCents}`)
    }
    if (amountCents < 0) {
      throw new Error(`Expense amount must not be negative: ${amountCents}`)
    }

    let owed = 0
    for (const [memberId, shareCents] of shares) {
      if (!Number.isSafeInteger(shareCents)) {
        throw new Error(`Share must be integer cents, got ${shareCents} for ${memberId}`)
      }
      owed += shareCents
    }
    if (owed !== amountCents) {
      throw new Error(`Expense shares sum to ${owed}, expected ${amountCents}`)
    }

    add(paidByMemberId, amountCents)
    for (const [memberId, shareCents] of shares) {
      add(memberId, -shareCents)
    }
  }

  return balances
}

/** One payment that moves `amountCents` from a debtor to a creditor. */
export interface Transfer {
  readonly fromMemberId: string
  readonly toMemberId: string
  readonly amountCents: number
}

/**
 * Reduces balances to a short list of payments: repeatedly settle the largest
 * debtor against the largest creditor.
 *
 * Each payment zeroes at least one of the two, so a group with `n` unsettled
 * members needs at most `n - 1` payments — and nobody ends up both paying and
 * receiving. This is the greedy heuristic, not a provably minimal solution:
 * finding the true minimum is NP-hard, and the difference only shows up in
 * contrived groups. Ties are broken by member id so the list is reproducible.
 */
export function simplifyDebts(balances: ReadonlyMap<string, number>): Transfer[] {
  const creditors: { memberId: string; cents: number }[] = []
  const debtors: { memberId: string; cents: number }[] = []
  let total = 0

  for (const [memberId, cents] of balances) {
    if (!Number.isSafeInteger(cents)) {
      throw new Error(`Balance must be integer cents, got ${cents} for ${memberId}`)
    }
    total += cents

    if (cents > 0) {
      creditors.push({ memberId, cents })
    } else if (cents < 0) {
      debtors.push({ memberId, cents: -cents })
    }
  }

  if (total !== 0) {
    throw new Error(`Balances must sum to zero, got ${total}`)
  }

  // Largest first; equal amounts fall back to member id so the output is stable.
  const bySize = (
    a: { memberId: string; cents: number },
    b: { memberId: string; cents: number },
  ): number => b.cents - a.cents || (a.memberId < b.memberId ? -1 : 1)

  const transfers: Transfer[] = []

  // Re-select the largest of each side every round. Sorting once and walking
  // the lists is not the same algorithm: after a payment the surviving party
  // carries a residual that is no longer the largest, and pairing it with the
  // next entry in the original order costs an avoidable extra payment in a few
  // percent of real groups. Group sizes are small, so re-sorting is free.
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(bySize)
    debtors.sort(bySize)

    const creditor = creditors[0]
    const debtor = debtors[0]
    if (creditor === undefined || debtor === undefined) {
      throw new Error('unreachable: a non-empty list has no first element')
    }

    const amountCents = Math.min(creditor.cents, debtor.cents)
    transfers.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amountCents,
    })

    // At least one side reaches zero, so every round removes someone and the
    // loop is bounded by the number of unsettled members.
    creditor.cents -= amountCents
    debtor.cents -= amountCents
    if (creditor.cents === 0) creditors.shift()
    if (debtor.cents === 0) debtors.shift()
  }

  return transfers
}

/**
 * Pure width math for BalanceBar's decorative proportional bar. No React,
 * no rendering — same reasoning as splitDraft.ts / memberUsage.ts living
 * beside the feature they support. Money text itself always comes from
 * <Money>/formatCents (CLAUDE.md's rule); this module produces no digits,
 * only a 0-100 percentage and a sign to color it by.
 */

export type BalanceSign = 'positive' | 'negative' | 'zero'

export function balanceSign(cents: number): BalanceSign {
  if (cents > 0) return 'positive'
  if (cents < 0) return 'negative'
  return 'zero'
}

/**
 * Width, as a percentage of the group's largest-magnitude balance. Guards
 * maxAbsCents <= 0 to 0 rather than dividing by zero into NaN — the one
 * caller (BalanceList, via maxAbsBalanceCents below) can only produce 0
 * there when every balance in the group is already zero, at which point
 * every bar should render with no width anyway.
 */
export function balanceBarWidthPercent(cents: number, maxAbsCents: number): number {
  if (maxAbsCents <= 0) {
    return 0
  }
  const ratio = Math.abs(cents) / maxAbsCents
  return Math.min(100, Math.max(0, ratio * 100))
}

/** The group max each bar is scaled against — 0 for an empty or all-settled group. */
export function maxAbsBalanceCents(
  balances: readonly { readonly balanceCents: number }[],
): number {
  return balances.reduce((max, b) => Math.max(max, Math.abs(b.balanceCents)), 0)
}

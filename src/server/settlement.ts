/**
 * Adapts stored expense rows into the pure settlement calculation in
 * core/settle.ts. This module does no I/O of its own — it only reshapes data
 * that's already been fetched (see server/db/groups.ts's GroupDetails) into
 * the shape core/settle.ts expects, and reshapes the result back into a plain
 * DTO-friendly form.
 */

import type { ExpenseRecord, Transfer } from '../core/settle.js'
import { computeBalances, simplifyDebts } from '../core/settle.js'
import type { GroupDetails } from './db/groups.js'

/** One expense row plus its materialised per-member shares. */
type ExpenseWithShares = GroupDetails['expenses'][number]

/** Converts stored expense rows into core's ExpenseRecord shape. */
export function toExpenseRecords(
  expenses: readonly ExpenseWithShares[],
): ExpenseRecord[] {
  return expenses.map((expense) => ({
    paidByMemberId: expense.paidByMemberId,
    amountCents: expense.amountCents,
    shares: new Map(expense.shares.map((share) => [share.memberId, share.shareCents])),
  }))
}

/** One member's net position, ready to serialise. */
export interface Balance {
  readonly memberId: string
  readonly balanceCents: number
}

/** A group's full settlement view: every member's balance, and the shortest payment list that zeroes them all. */
export interface Settlement {
  readonly balances: readonly Balance[]
  readonly transfers: readonly Transfer[]
}

/**
 * Computes the settlement view for a group.
 *
 * computeBalances only returns entries for members who paid for or owed a
 * share of at least one expense, so a member with no expense activity yet
 * would otherwise vanish from the result. We seed a complete zero balance for
 * every member in the group first, then overlay computeBalances's actual
 * results on top — and run simplifyDebts over that same full, seeded map, so
 * balances and transfers are always computed over an identical universe of
 * members.
 */
export function settleGroup(details: GroupDetails): Settlement {
  const records = toExpenseRecords(details.expenses)
  const computed = computeBalances(records)

  const fullBalances = new Map<string, number>()
  for (const member of details.members) {
    fullBalances.set(member.id, 0)
  }
  for (const [memberId, balanceCents] of computed) {
    fullBalances.set(memberId, balanceCents)
  }

  const transfers = simplifyDebts(fullBalances)

  const balances = [...fullBalances.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([memberId, balanceCents]) => ({ memberId, balanceCents }))

  return { balances, transfers }
}

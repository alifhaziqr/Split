/**
 * Predicts, from data already in hand, whether removing a member would hit
 * the server's MEMBER_REFERENCED 409 — so MemberList can disable Remove with
 * a visible reason instead of letting the user fire a request that can't
 * succeed. A member is referenced if they paid for an expense OR appear in
 * any expense's shares — both block deletion server-side (see
 * src/server/db/members.ts's ON DELETE RESTRICT foreign keys).
 *
 * `isMemberReferenced` and `countReferencingExpenses` share one predicate
 * so the two can't drift: a member counted in N>0 expenses must always be
 * "referenced", and vice versa.
 */

import type { WireExpense } from '../../net/types.js'

function referencesMember(expense: WireExpense, memberId: string): boolean {
  return (
    expense.paidByMemberId === memberId ||
    expense.shares.some((share) => share.memberId === memberId)
  )
}

export function isMemberReferenced(
  memberId: string,
  expenses: readonly WireExpense[],
): boolean {
  return expenses.some((expense) => referencesMember(expense, memberId))
}

export function countReferencingExpenses(
  memberId: string,
  expenses: readonly WireExpense[],
): number {
  return expenses.filter((expense) => referencesMember(expense, memberId)).length
}

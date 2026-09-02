import { EmptyState } from '../../components/EmptyState.js'
import { useDeleteExpense } from '../../queries/expenses.js'
import type { WireExpense, WireMember } from '../../net/types.js'
import { ExpenseRow } from './ExpenseRow.js'

export function ExpenseList(props: {
  readonly groupId: string
  readonly expenses: readonly WireExpense[]
  readonly members: readonly WireMember[]
  readonly currency: string
}) {
  const deleteExpense = useDeleteExpense()

  if (props.expenses.length === 0) {
    return <EmptyState message="No expenses yet" />
  }

  return (
    <ul className="space-y-2">
      {/* Order preserved as served — the server already sorts newest-first
          (see server/api/dto.ts's toGroupDetailsDto), so this must not re-sort. */}
      {props.expenses.map((expense) => (
        <ExpenseRow
          key={expense.id}
          expense={expense}
          members={props.members}
          currency={props.currency}
          onDelete={() => deleteExpense.mutate({ expenseId: expense.id, groupId: props.groupId })}
        />
      ))}
    </ul>
  )
}

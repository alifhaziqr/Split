import { useParams } from 'react-router'

import { GroupGate } from '../components/GroupGate.js'
import { AddExpenseForm } from '../features/expenses/AddExpenseForm.js'

export function AddExpensePage() {
  const { groupId } = useParams()

  // GroupGate reads the same cached group query the detail page already
  // populated — the member list this form needs costs no extra fetch on
  // the normal navigation path, and self-loads on a direct hit to this URL.
  return (
    <GroupGate groupId={groupId}>
      {(details) => <AddExpenseForm groupId={details.id} members={details.members} />}
    </GroupGate>
  )
}

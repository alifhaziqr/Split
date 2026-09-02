import { useParams } from 'react-router'

import { isApiError } from '../net/apiError.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { GroupNotFoundNotice } from '../components/GroupNotFoundNotice.js'
import { Spinner } from '../components/Spinner.js'
import { AddExpenseForm } from '../features/expenses/AddExpenseForm.js'
import { useGroupQuery } from '../queries/groups.js'

export function AddExpensePage() {
  const { groupId } = useParams()

  return groupId === undefined ? <ErrorBanner error={null} /> : <AddExpensePageContent groupId={groupId} />
}

function AddExpensePageContent(props: { readonly groupId: string }) {
  // Reads the group query the detail page already populated — the member
  // list this form needs costs no extra fetch on the normal navigation
  // path, and self-loads on a direct hit to this URL.
  const group = useGroupQuery(props.groupId)

  if (group.isPending) {
    return <Spinner label="Loading…" />
  }
  if (group.isError) {
    if (isApiError(group.error) && group.error.code === 'GROUP_NOT_FOUND') {
      return <GroupNotFoundNotice />
    }
    return <ErrorBanner error={group.error} />
  }

  return <AddExpenseForm groupId={props.groupId} members={group.data.members} />
}

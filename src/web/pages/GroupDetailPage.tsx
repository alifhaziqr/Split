import { Link, useParams } from 'react-router'

import { isApiError } from '../net/apiError.js'
import { ErrorBanner } from '../components/ErrorBanner.js'
import { GroupNotFoundNotice } from '../components/GroupNotFoundNotice.js'
import { Spinner } from '../components/Spinner.js'
import { AddMemberForm } from '../features/members/AddMemberForm.js'
import { MemberList } from '../features/members/MemberList.js'
import { ExpenseList } from '../features/expenses/ExpenseList.js'
import { GroupHeader } from '../features/groups/GroupHeader.js'
import { SettlementSection } from '../features/settlement/SettlementSection.js'
import { useGroupQuery } from '../queries/groups.js'

export function GroupDetailPage() {
  const { groupId } = useParams()

  return groupId === undefined ? <ErrorBanner error={null} /> : <GroupDetailPageContent groupId={groupId} />
}

function GroupDetailPageContent(props: { readonly groupId: string }) {
  const group = useGroupQuery(props.groupId)

  if (group.isPending) {
    return <Spinner label="Loading group…" />
  }

  if (group.isError) {
    if (isApiError(group.error) && group.error.code === 'GROUP_NOT_FOUND') {
      return <GroupNotFoundNotice />
    }
    return <ErrorBanner error={group.error} />
  }

  const details = group.data

  return (
    <div>
      <GroupHeader group={details} />

      <section>
        <h2>Members</h2>
        <MemberList groupId={details.id} members={details.members} expenses={details.expenses} />
        <AddMemberForm groupId={details.id} />
      </section>

      <section>
        <h2>Expenses</h2>
        <ExpenseList groupId={details.id} expenses={details.expenses} members={details.members} currency={details.currency} />
        <Link to={`/groups/${details.id}/expenses/new`}>Add expense</Link>
      </section>

      <SettlementSection groupId={details.id} members={details.members} currency={details.currency} />
    </div>
  )
}

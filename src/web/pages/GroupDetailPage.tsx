import { Link, useParams } from 'react-router'

import { GroupGate } from '../components/GroupGate.js'
import { AddMemberForm } from '../features/members/AddMemberForm.js'
import { MemberList } from '../features/members/MemberList.js'
import { ExpenseList } from '../features/expenses/ExpenseList.js'
import { GroupHeader } from '../features/groups/GroupHeader.js'
import { SettlementSection } from '../features/settlement/SettlementSection.js'

export function GroupDetailPage() {
  const { groupId } = useParams()

  return (
    <GroupGate groupId={groupId}>
      {(details) => (
        <div>
          <GroupHeader group={details} />

          <section>
            <h2>Members</h2>
            <MemberList groupId={details.id} members={details.members} expenses={details.expenses} />
            <AddMemberForm groupId={details.id} />
          </section>

          <section>
            <h2>Expenses</h2>
            <ExpenseList
              groupId={details.id}
              expenses={details.expenses}
              members={details.members}
              currency={details.currency}
            />
            <Link to={`/groups/${details.id}/expenses/new`}>Add expense</Link>
          </section>

          <SettlementSection groupId={details.id} members={details.members} currency={details.currency} />
        </div>
      )}
    </GroupGate>
  )
}

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
        <div className="space-y-6">
          <GroupHeader group={details} />

          <section className="space-y-3 rounded-lg border border-subtle bg-surface p-4">
            <h2>Members</h2>
            <MemberList groupId={details.id} members={details.members} expenses={details.expenses} />
            <AddMemberForm groupId={details.id} />
          </section>

          <section className="space-y-3 rounded-lg border border-subtle bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2>Expenses</h2>
              <Link to={`/groups/${details.id}/expenses/new`} className="text-sm font-medium">
                Add expense
              </Link>
            </div>
            <ExpenseList
              groupId={details.id}
              expenses={details.expenses}
              members={details.members}
              currency={details.currency}
            />
          </section>

          <SettlementSection groupId={details.id} members={details.members} currency={details.currency} />
        </div>
      )}
    </GroupGate>
  )
}

import { ErrorBanner } from '../components/ErrorBanner.js'
import { Spinner } from '../components/Spinner.js'
import { CreateGroupForm } from '../features/groups/CreateGroupForm.js'
import { GroupList } from '../features/groups/GroupList.js'
import { useGroupsQuery } from '../queries/groups.js'

export function GroupsPage() {
  const groups = useGroupsQuery()

  return (
    <div className="space-y-6">
      <h1>Groups</h1>
      <div className="rounded-3xl border border-subtle bg-surface p-4 shadow-sm">
        <CreateGroupForm />
      </div>
      {groups.isPending && <Spinner label="Loading groups…" />}
      {groups.isError && <ErrorBanner error={groups.error} />}
      {groups.isSuccess && <GroupList groups={groups.data.groups} />}
    </div>
  )
}

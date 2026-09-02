import { useNavigate } from 'react-router'

import { ConfirmButton } from '../../components/ConfirmButton.js'
import { ErrorBanner } from '../../components/ErrorBanner.js'
import { useDeleteGroup } from '../../queries/groups.js'
import type { WireGroupDetails } from '../../net/types.js'

export function GroupHeader(props: { readonly group: WireGroupDetails }) {
  const navigate = useNavigate()
  const deleteGroup = useDeleteGroup()
  const { group } = props
  // Predicts the server's GROUP_NOT_EMPTY 409 from data already in hand, so
  // the user never fires a delete that can't succeed — see CLAUDE.md's M5
  // error-UX note. deleteGroup.error still renders below for the race where
  // the cache is stale and the server disagrees.
  const isEmpty = group.members.length === 0 && group.expenses.length === 0

  function handleDelete() {
    deleteGroup.mutate(group.id, {
      onSuccess: () => {
        void navigate('/')
      },
    })
  }

  return (
    <header>
      <h1>{group.name}</h1>
      <p>{group.currency}</p>
      <ConfirmButton onConfirm={handleDelete} disabled={!isEmpty || deleteGroup.isPending}>
        Delete group
      </ConfirmButton>
      {!isEmpty && (
        <p>
          This group still has {group.members.length} members and {group.expenses.length} expenses.
        </p>
      )}
      <ErrorBanner error={deleteGroup.error} />
    </header>
  )
}

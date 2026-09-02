import { Link } from 'react-router'

import { EmptyState } from '../../components/EmptyState.js'
import type { WireGroup } from '../../net/types.js'

export function GroupList(props: { readonly groups: readonly WireGroup[] }) {
  if (props.groups.length === 0) {
    return <EmptyState message="No groups yet" />
  }

  return (
    <ul>
      {props.groups.map((group) => (
        <li key={group.id}>
          <Link to={`/groups/${group.id}`}>
            {group.name} ({group.currency})
          </Link>
        </li>
      ))}
    </ul>
  )
}

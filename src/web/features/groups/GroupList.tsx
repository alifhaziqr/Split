import { Link } from 'react-router'

import { EmptyState } from '../../components/EmptyState.js'
import type { WireGroup } from '../../net/types.js'

export function GroupList(props: { readonly groups: readonly WireGroup[] }) {
  if (props.groups.length === 0) {
    return <EmptyState message="No groups yet" />
  }

  return (
    <ul className="space-y-2">
      {props.groups.map((group) => (
        <li key={group.id} className="rounded-lg border border-subtle bg-surface">
          <Link
            to={`/groups/${group.id}`}
            className="flex items-center justify-between px-4 py-3 no-underline hover:bg-canvas hover:no-underline"
          >
            <span className="font-medium text-fg">{group.name}</span>
            <span className="text-sm text-muted">{group.currency}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

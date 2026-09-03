import { Link } from 'react-router'

import { EmptyState } from '../../components/EmptyState.js'
import { EmptyGroupsIllustration } from '../../components/illustrations.js'
import type { WireGroup } from '../../net/types.js'

export function GroupList(props: { readonly groups: readonly WireGroup[] }) {
  if (props.groups.length === 0) {
    return (
      <EmptyState
        message="No groups yet"
        illustration={<EmptyGroupsIllustration className="h-full w-full" />}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {props.groups.map((group) => (
        <Link
          key={group.id}
          to={`/groups/${group.id}`}
          className="hero-panel flex flex-col gap-1 rounded-3xl border border-subtle bg-surface p-5 shadow-sm no-underline hover:no-underline"
        >
          <span className="text-base font-semibold text-fg">{group.name}</span>
          <span className="text-sm text-muted">{group.currency}</span>
        </Link>
      ))}
    </div>
  )
}

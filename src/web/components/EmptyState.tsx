/**
 * "No groups yet" / "No expenses yet" shell. `illustration` is optional —
 * only the spots called out in docs/adr/0001-ui-restyle-scope.md pass one;
 * everywhere else stays the bare message, unchanged.
 */

import type { ReactNode } from 'react'

export function EmptyState(props: {
  readonly message: string
  readonly illustration?: ReactNode
}) {
  if (!props.illustration) {
    return <p className="text-sm text-muted">{props.message}</p>
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="h-20 w-28 text-accent">{props.illustration}</div>
      <p className="text-sm text-muted">{props.message}</p>
    </div>
  )
}

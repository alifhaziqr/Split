/**
 * Owns the fetch-and-classify policy shared by every page that reaches a
 * group by id (GroupDetailPage, AddExpensePage, ...): loading, a dedicated
 * "gone" state for GROUP_NOT_FOUND, a generic banner for anything else, or
 * the fetched details. Before this module, each page hand-copied the same
 * useGroupQuery + isPending/isError/isApiError switch.
 *
 * `useGroupGate` is exported on its own as the pure, DOM-free state
 * machine (test it via renderHook, the same instinct as splitDraft.ts's
 * splitStatus). `GroupGate` is a thin wrapper that also renders the three
 * shared branches, so a page supplies only its ready-case content.
 */

import type { ReactNode } from 'react'

import { isApiError } from '../net/apiError.js'
import type { WireGroupDetails } from '../net/types.js'
import { useGroupQuery } from '../queries/groups.js'
import { ErrorBanner } from './ErrorBanner.js'
import { GroupNotFoundNotice } from './GroupNotFoundNotice.js'
import { Spinner } from './Spinner.js'

export type GroupGateState =
  | { readonly status: 'loading' }
  | { readonly status: 'gone' }
  | { readonly status: 'error'; readonly error: unknown }
  | { readonly status: 'ready'; readonly details: WireGroupDetails }

export function useGroupGate(groupId: string | undefined): GroupGateState {
  if (groupId === undefined) {
    // Every route that renders a GroupGate is matched on a `:groupId`
    // path segment, so a missing param means the route table itself is
    // wrong — a programmer error, not a state a user can reach. Mirrors
    // the server's own requireParam, which throws for the same reason.
    throw new Error('GroupGate rendered without a groupId param')
  }

  const group = useGroupQuery(groupId)

  if (group.isPending) {
    return { status: 'loading' }
  }
  if (group.isError) {
    if (isApiError(group.error) && group.error.code === 'GROUP_NOT_FOUND') {
      return { status: 'gone' }
    }
    return { status: 'error', error: group.error }
  }
  return { status: 'ready', details: group.data }
}

export function GroupGate(props: {
  readonly groupId: string | undefined
  readonly children: (details: WireGroupDetails) => ReactNode
}) {
  const gate = useGroupGate(props.groupId)

  switch (gate.status) {
    case 'loading':
      return <Spinner label="Loading group…" />
    case 'gone':
      return <GroupNotFoundNotice />
    case 'error':
      return <ErrorBanner error={gate.error} />
    case 'ready':
      return <>{props.children(gate.details)}</>
  }
}
